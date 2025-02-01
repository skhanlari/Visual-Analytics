// Define vibrant colors and margins
const colorPalette = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728"];
const margin = { top: 20, right: 30, bottom: 50, left: 50 };

// Function to get container dimensions dynamically
const updateDimensions = () => {
  const scatterContainer = document.getElementById("scatterplot-container");
  const barContainer = document.getElementById("barchart-container");

  return {
    scatter: {
      width: scatterContainer ? scatterContainer.clientWidth : window.innerWidth * 0.6,
      height: scatterContainer ? scatterContainer.clientHeight : window.innerHeight * 0.6,
    },
    bar: {
      width: barContainer ? barContainer.clientWidth : window.innerWidth * 0.35,
      height: barContainer ? barContainer.clientHeight : window.innerHeight * 0.4,
    },
  };
};

let scatter, bar, selectedCluster = null;
window.addEventListener("load", () => {
  ({ scatter, bar } = updateDimensions());
  createScatterplot([]); // Ensure initial render
  createBarchart([]);
});

let data;


d3.csv("../data/pca_results_with_clusters.csv").then(csvData => {
  data = csvData;
  data.forEach(d => {
    d.pca_x = +d.pca_x;
    d.pca_y = +d.pca_y;
    d.cluster = +d.cluster;
    d.loudness = +d.loudness;
    d.energy = +d.energy;
    d.danceability = +d.danceability;
    d.liveness = +d.liveness;
    d.valence = +d.valence;
    d.speechiness = +d.speechiness;
    d.instrumentalness = +d.instrumentalness;
    d.mode = +d.mode;
    d.acousticness = +d.acousticness;
  });

  const normalize = (val, min, max) => (val - min) / (max - min);
  const minLoudness = d3.min(data, d => d.loudness), maxLoudness = d3.max(data, d => d.loudness);
  data.forEach(d => d.loudness = normalize(d.loudness, minLoudness, maxLoudness));

  const scatterSvg = createScatterplot(data);
  const barSvg = createBarchart();
  updateBarChart(data, barSvg, null);
  updateClusterInfo(data, null);
  createFilters(data);
  updatePopularityCharts(data);

  document.getElementById("reset-view").addEventListener("click", () => {
    selectedCluster = null;
    updateBarChart(data, barSvg, null);
    updateClusterInfo(data, null);
    updateFilters(data, null);
    updatePopularityCharts(data);
    scatterSvg.selectAll(".scatter-circle").attr("opacity", 1);
  });
});

function createScatterplot(data) {
  d3.select("#scatterplot-container").html("");
  const scatterSvg = d3.select("#scatterplot-container")
    .append("svg").attr("width", scatter.width).attr("height", scatter.height)
    .append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

  const xScale = d3.scaleLinear().domain(d3.extent(data, d => d.pca_x)).range([0, scatter.width - margin.left - margin.right]);
  const yScale = d3.scaleLinear().domain(d3.extent(data, d => d.pca_y)).range([scatter.height - margin.top - margin.bottom, 0]);

  scatterSvg.append("g").attr("transform", `translate(0, ${scatter.height - margin.top - margin.bottom})`).call(d3.axisBottom(xScale));
  scatterSvg.append("g").call(d3.axisLeft(yScale));
  scatterSvg.selectAll(".scatter-circle").attr("opacity", c => (c.cluster === selectedCluster ? 1 : 0.3));

  scatterSvg.selectAll(".scatter-circle").data(data).enter().append("circle")
    .attr("cx", d => xScale(d.pca_x)).attr("cy", d => yScale(d.pca_y)).attr("r", 4)
    .attr("fill", d => colorPalette[d.cluster % colorPalette.length])
    .attr("class", "scatter-circle").attr("stroke", "black").attr("stroke-width", 0.5)
    .on("click", function (event, d) {
      selectedCluster = d.cluster;
      const clusterData = data.filter(x => x.cluster === selectedCluster);
      updateBarChart(clusterData, d3.select("#barchart-container svg g"), selectedCluster);
      updatePopularityCharts(clusterData);
      updateFilters(data, selectedCluster);
      updateClusterInfo(data, selectedCluster);
      scatterSvg.selectAll(".scatter-circle").attr("opacity", c => (c.cluster === selectedCluster ? 1 : 0.3));
    });
  return scatterSvg;
}

function createBarchart() {
  d3.select("#barchart-container").html("");
  return d3.select("#barchart-container")
    .append("svg").attr("width", bar.width).attr("height", bar.height)
    .append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
}

function updateBarChart(data, barSvg, cluster) {
  const audioFeatures = ['energy', 'danceability', 'loudness', 'liveness', 'valence', 'speechiness', 'instrumentalness', 'mode', 'acousticness'];
  const averages = Object.fromEntries(audioFeatures.map(f => [f, d3.mean(data, d => d[f]) || 0]));

  const xScale = d3.scaleBand().domain(audioFeatures).range([0, bar.width - margin.left - margin.right]).padding(0.4);
  const yScale = d3.scaleLinear().domain([0, 1]).range([bar.height - margin.top - margin.bottom, 0]);

  barSvg.selectAll("rect").data(Object.entries(averages))
    .join("rect")
    .transition().duration(500)
    .attr("x", d => xScale(d[0])).attr("y", d => yScale(d[1]))
    .attr("width", xScale.bandwidth()).attr("height", d => bar.height - margin.top - margin.bottom - yScale(d[1]))
    .attr("fill", cluster === null ? "#FFA500" : "#1E90FF");

  barSvg.selectAll("text").remove();
  barSvg.selectAll(".bar-text").data(Object.entries(averages))
    .join("text")
    .attr("class", "bar-text")
    .attr("x", d => xScale(d[0]) + xScale.bandwidth() / 2)
    .attr("y", d => yScale(d[1]) - 5)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .attr("font-size", "12px")
    .text(d => d[1].toFixed(2));

  barSvg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${bar.height - margin.top - margin.bottom})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
    .style("fill", "white")
    .style("font-size", "12px")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  barSvg.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(yScale))
    .selectAll("text")
    .style("fill", "white")
    .style("font-size", "12px");
}

function updateClusterInfo(data, cluster) {
  const clusterDetails = document.getElementById("cluster-details");
  const resetButton = document.getElementById("reset-view");

  const allSongs = data.length;
  const avgValsAll = {
    danceability: (d3.mean(data, d => d.danceability) || 0).toFixed(2),
    energy: (d3.mean(data, d => d.energy) || 0).toFixed(2),
    valence: (d3.mean(data, d => d.valence) || 0).toFixed(2),
    loudness: (d3.mean(data, d => d.loudness) || 0).toFixed(2),
  };

  if (cluster === null) {
    clusterDetails.innerHTML = `
      <h3>📊 Dataset Overview</h3>
      <div class="info-grid">
        <div class="info-item">🎵 ${allSongs}<span>Total Songs</span></div>
        <div class="info-item">💃 ${avgValsAll.danceability}<span>Avg Danceability</span></div>
        <div class="info-item">⚡ ${avgValsAll.energy}<span>Avg Energy</span></div>
        <div class="info-item">😊 ${avgValsAll.valence}<span>Avg Valence</span></div>
        <div class="info-item">🔊 ${avgValsAll.loudness} dB<span>Avg Loudness</span></div>
      </div>`;
    resetButton.style.display = "none";
    return;
  }

  const clusterSongs = data.filter(d => d.cluster === cluster);
  const avgVals = {
    danceability: (d3.mean(clusterSongs, d => d.danceability) || 0).toFixed(2),
    energy: (d3.mean(clusterSongs, d => d.energy) || 0).toFixed(2),
    valence: (d3.mean(clusterSongs, d => d.valence) || 0).toFixed(2),
    loudness: (d3.mean(clusterSongs, d => d.loudness) || 0).toFixed(2),
  };

  clusterDetails.innerHTML = `
    <h3>🔍 Cluster ${cluster} Details</h3>
    <div class="info-grid">
      <div class="info-item">🎵 ${clusterSongs.length}<span>Songs</span></div>
      <div class="info-item">💃 ${avgVals.danceability}<span>Avg Danceability</span></div>
      <div class="info-item">⚡ ${avgVals.energy}<span>Avg Energy</span></div>
      <div class="info-item">😊 ${avgVals.valence}<span>Avg Valence</span></div>
      <div class="info-item">🔊 ${avgVals.loudness} dB<span>Avg Loudness</span></div>
    </div>`;
  resetButton.style.display = "block";
}

function splitArtists(artistString) {
  // Define a unique token that is unlikely to appear in other names.
  const token = "Tyler_The_Creator";
  // Replace the exception with the token.
  const safeString = artistString.replace(/Tyler,\s*The\s*Creator/g, token);
  // Split on commas (with optional whitespace) and then convert the token back.
  return safeString.split(/,\s*/).map(artist => artist === token ? "Tyler, The Creator" : artist);
}

function createFilters(dataForFilters) {
  const genreFilterDiv = document.getElementById('genre-filters');
  const artistFilterDiv = document.getElementById('artist-filters');

  // Clear any existing filters.
  genreFilterDiv.innerHTML = "";
  artistFilterDiv.innerHTML = "";

  // Generate unique genres as before.
  const genres = Array.from(new Set(dataForFilters.map(d => d.playlist_genre)));

  // Generate unique artists by splitting the track_artist field using splitArtists.
  const artistSet = new Set();
  dataForFilters.forEach(d => {
    splitArtists(d.track_artist).forEach(artist => {
      artistSet.add(artist);
    });
  });
  const artists = Array.from(artistSet);

  // Create a checkbox for each genre.
  genres.forEach(genre => {
    const checkboxItem = document.createElement('div');
    checkboxItem.className = 'checkbox-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = genre;
    checkbox.id = 'genre-' + genre.replace(/\s+/g, '-').toLowerCase();
    checkbox.addEventListener('change', onFilterChange);

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = genre;

    checkboxItem.appendChild(checkbox);
    checkboxItem.appendChild(label);
    genreFilterDiv.appendChild(checkboxItem);
  });

  // Create a checkbox for each artist.
  artists.forEach(artist => {
    const checkboxItem = document.createElement('div');
    checkboxItem.className = 'checkbox-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = artist;
    checkbox.id = 'artist-' + artist.replace(/\s+/g, '-').toLowerCase();
    checkbox.addEventListener('change', onFilterChange);

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = artist;

    checkboxItem.appendChild(checkbox);
    checkboxItem.appendChild(label);
    artistFilterDiv.appendChild(checkboxItem);
  });
}

function updateFilters(data, cluster) {
  let dataForFilters = data;
  if (cluster !== null) {
    dataForFilters = data.filter(d => d.cluster === cluster);
  }
  createFilters(dataForFilters);
}

function onFilterChange() {
  applyFilters();
}

function applyFilters() {
  const genreFilterDiv = document.getElementById('genre-filters');
  const artistFilterDiv = document.getElementById('artist-filters');

  const selectedGenres = Array.from(
    genreFilterDiv.querySelectorAll('input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  const selectedArtists = Array.from(
    artistFilterDiv.querySelectorAll('input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  // Start with the full dataset or, if a cluster is selected, only that cluster’s data.
  let filteredData = data;
  if (selectedCluster !== null) {
    filteredData = filteredData.filter(d => d.cluster === selectedCluster);
  }
  // Apply the genre filter if any genres are selected.
  if (selectedGenres.length > 0) {
    filteredData = filteredData.filter(d => selectedGenres.includes(d.playlist_genre));
  }
  // Apply the artist filter if any artists are selected.
  if (selectedArtists.length > 0) {
    filteredData = filteredData.filter(d => {
      // Use the helper to safely split the track_artist field.
      const artists = splitArtists(d.track_artist);
      // Check if any of the artists are in the selected filters.
      return artists.some(artist => selectedArtists.includes(artist));
    });
  }

  // Update the visualizations with the filtered data.
  updateBarChart(filteredData, d3.select("#barchart-container svg g"), selectedCluster);
  updateClusterInfo(filteredData, selectedCluster);
  updatePopularityCharts(filteredData);
}

function filterCheckboxes(containerId, searchValue) {
  const container = document.getElementById(containerId);
  const items = container.querySelectorAll('.checkbox-item');
  items.forEach(item => {
    const labelText = item.querySelector('label').textContent.toLowerCase();
    // If the search query is found in the label text, show the item; otherwise, hide it.
    if (labelText.indexOf(searchValue.toLowerCase()) !== -1) {
      item.style.display = 'flex';  // 'flex' since our layout uses flex; use '' if needed.
    } else {
      item.style.display = 'none';
    }
  });
}

// Add event listener for the genre search field.
document.getElementById('genre-search').addEventListener('input', function (e) {
  const searchValue = e.target.value;
  filterCheckboxes('genre-filters', searchValue);
});

// Add event listener for the artist search field.
document.getElementById('artist-search').addEventListener('input', function (e) {
  const searchValue = e.target.value;
  filterCheckboxes('artist-filters', searchValue);
});

function updatePopularityCharts(filteredData) {
  console.log("inside updatePopularityCharts");
  // Aggregate popularity by genre (using playlist_genre)
  const genreMap = {};
  filteredData.forEach(d => {
    // Ensure the record has a valid genre and track_popularity value.
    if (d.playlist_genre && d.track_popularity != null) {
      if (!genreMap[d.playlist_genre]) {
        genreMap[d.playlist_genre] = { sum: 0, count: 0 };
      }
      // Convert track_popularity to number if necessary.
      genreMap[d.playlist_genre].sum += +d.track_popularity;
      genreMap[d.playlist_genre].count += 1;
    }
  });
  // Create an array of objects with genre and average popularity
  let genreData = Object.entries(genreMap).map(([genre, obj]) => ({
    playlist_genre: genre,
    avgPopularity: obj.sum / obj.count
  }));
  // Sort descending by average popularity and take top 10
  genreData.sort((a, b) => b.avgPopularity - a.avgPopularity);
  genreData = genreData.slice(0, 10);

  // Similarly, aggregate by artist (using track_artist)
  // Similarly, aggregate by artist (using track_artist) with exception handling.
  const artistMap = {};
  filteredData.forEach(d => {
    if (d.track_artist && d.track_popularity != null) {
      // Use splitArtists to handle multiple artists and the exception.
      splitArtists(d.track_artist).forEach(artist => {
        if (!artistMap[artist]) {
          artistMap[artist] = { sum: 0, count: 0 };
        }
        artistMap[artist].sum += +d.track_popularity;
        artistMap[artist].count += 1;
      });
    }
  });
  let artistData = Object.entries(artistMap).map(([artist, obj]) => ({
    track_artist: artist,
    avgPopularity: obj.sum / obj.count
  }));
  artistData.sort((a, b) => b.avgPopularity - a.avgPopularity);
  artistData = artistData.slice(0, 10);
  console.log("genreData", genreData);
  console.log("artistData", artistData);
  // Now update the two horizontal bar charts.
  updateHorizontalBarChart("#top-genres-chart", genreData, "playlist_genre");
  updateHorizontalBarChart("#top-artists-chart", artistData, "track_artist");
}

function updateHorizontalBarChart(selector, data, labelField) {
  // Get the container element and its dimensions.
  const container = document.querySelector(selector);
  let containerWidth = container.offsetWidth;
  let containerHeight = container.offsetHeight;

  // Fallback defaults if container dimensions are very small.
  if (containerWidth < 100) containerWidth = 300;
  if (containerHeight < 50) containerHeight = 200;

  // Use minimal margins to maximize drawing area.
  // Increase bottom margin slightly to accommodate the x axis.
  const marginChart = { top: 2, right: 70, bottom: 20, left: 10 };
  const width = containerWidth - marginChart.left - marginChart.right;
  const height = containerHeight - marginChart.top - marginChart.bottom;

  // Clear any previous SVG.
  d3.select(selector).select("svg").remove();

  // Append the SVG element that fills the container.
  const svg = d3.select(selector)
    .append("svg")
    .attr("width", containerWidth)
    .attr("height", containerHeight)
    .append("g")
    .attr("transform", `translate(${marginChart.left},${marginChart.top})`);

  // x scale: fixed to track popularity range 0–100.
  const x = d3.scaleLinear()
    .domain([0, 100])
    .range([0, width]);

  // y scale: a band scale for each label.
  const y = d3.scaleBand()
    .domain(data.map(d => d[labelField]))
    .range([0, height])
    .padding(0.1);

  // Draw the bars.
  svg.selectAll(".bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", 0)
    .attr("y", d => y(d[labelField]))
    .attr("width", d => x(d.avgPopularity))
    .attr("height", y.bandwidth())
    .attr("fill", "#1E90FF");

  // Append white text showing the genre/artist name next to each bar.
  svg.selectAll(".label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("x", d => x(d.avgPopularity) + 3)  // Positioned just to the right of the bar.
    .attr("y", d => y(d[labelField]) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .style("fill", "#fff")
    .style("font-size", "10px")
    .text(d => d[labelField]);

  // Append the x-axis at the bottom of the chart.
  svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x).ticks(4))
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "#fff");
}