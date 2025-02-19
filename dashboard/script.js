// Define vibrant colors and margins
const colorPalette = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728"];
const margin = { top: 20, right: 30, bottom: 50, left: 50 };

// Global variables for dimensions and filtering.
let scatter, bar, selectedCluster = null;
let selectedDateRange = null;

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

window.addEventListener("load", () => {
  ({ scatter, bar } = updateDimensions());
  createScatterplot([]); // Initial render
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
    if (d.track_album_release_date) {
      d.track_album_release_date = new Date(d.track_album_release_date);
    }
  });

  // Normalize loudness
  const normalize = (val, min, max) => (val - min) / (max - min);
  const minLoudness = d3.min(data, d => d.loudness), maxLoudness = d3.max(data, d => d.loudness);
  data.forEach(d => d.loudness = normalize(d.loudness, minLoudness, maxLoudness));

  // Create the main visualizations.
  const scatterSvg = createScatterplot(data);
  const barSvg = createBarchart();
  updateBarChart(data, barSvg, null);
  updateClusterInfo(data, null);
  createFilters(data);
  updatePopularityCharts(data);

  // Create the date-interval area chart
  createDateIntervalSelector(data);

  document.getElementById("reset-view").addEventListener("click", () => {
    selectedCluster = null;
    selectedDateRange = null;
    createDateIntervalSelector(data);
    updateBarChart(data, barSvg, null);
    updateClusterInfo(data, null);
    updateFilters(data, null);
    updatePopularityCharts(data);
    updateTopTracksChart(data);
    scatterSvg.selectAll(".scatter-circle").attr("opacity", 1);
  });
});

/* ---------------------- Visualization Functions ---------------------- */

function createScatterplot(data) {
  // Clear any existing scatterplot.
  d3.select("#scatterplot-container").html("");

  const scatterSvg = d3.select("#scatterplot-container")
    .append("svg")
    .attr("width", scatter.width)
    .attr("height", scatter.height)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  // Define the scales based on the full data.
  const xScale = d3.scaleLinear()
    .domain(d3.extent(data, d => d.pca_x))
    .range([0, scatter.width - margin.left - margin.right]);
    
  const yScale = d3.scaleLinear()
    .domain(d3.extent(data, d => d.pca_y))
    .range([scatter.height - margin.top - margin.bottom, 0]);

  // Append axes.
  scatterSvg.append("g")
    .attr("transform", `translate(0, ${scatter.height - margin.top - margin.bottom})`)
    .call(d3.axisBottom(xScale));
    
  scatterSvg.append("g")
    .call(d3.axisLeft(yScale));

  // Draw all data points.
  scatterSvg.selectAll(".scatter-circle")
    .data(data)
    .enter()
    .append("circle")
      .attr("class", "scatter-circle")
      .attr("cx", d => xScale(d.pca_x))
      .attr("cy", d => yScale(d.pca_y))
      .attr("r", 4)
      .attr("fill", d => colorPalette[d.cluster % colorPalette.length])
      .attr("stroke", "black")
      .attr("stroke-width", 0.5)
      .attr("opacity", 1) // Initially, all dots are fully opaque.
      .on("click", function(event, d) {
        // When a circle is clicked, update the selected cluster.
        selectedCluster = d.cluster;
        
        // Update the opacity of the dots: only the dots in the selected cluster are fully opaque.
        updateScatterplotOpacity();

        // Filter the data for the selected cluster for the other charts.
        const clusterData = data.filter(x => x.cluster === selectedCluster);

        // Update other visualizations with the filtered data.
        updateBarChart(clusterData, d3.select("#barchart-container svg g"), selectedCluster);
        updatePopularityCharts(clusterData);
        updateFilters(data, selectedCluster);
        updateClusterInfo(data, selectedCluster);
        updateTopTracksChart(clusterData);
        // Refresh the date interval selector with the cluster data.
        d3.select("#date-interval-selector").html("");
        createDateIntervalSelector(clusterData);
      });
  
  return scatterSvg;
}

// Helper function to update opacity without re-rendering the scatterplot.
function updateScatterplotOpacity() {
  d3.selectAll(".scatter-circle")
    .attr("opacity", d => {
      // If no cluster is selected, show all dots fully.
      if (selectedCluster === null) return 1;
      // Otherwise, highlight dots that belong to the selected cluster.
      return d.cluster === selectedCluster ? 1 : 0.3;
    });
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

  const xScale = d3.scaleBand()
    .domain(audioFeatures)
    .range([0, bar.width - margin.left - margin.right])
    .padding(0.4);
  const yScale = d3.scaleLinear().domain([0, 1]).range([bar.height - margin.top - margin.bottom, 0]);

  barSvg.selectAll("rect").data(Object.entries(averages))
    .join("rect")
    .transition().duration(500)
    .attr("x", d => xScale(d[0]))
    .attr("y", d => yScale(d[1]))
    .attr("width", xScale.bandwidth())
    .attr("height", d => bar.height - margin.top - margin.bottom - yScale(d[1]))
    .attr("fill", cluster === null ? "magenta" : colorPalette[cluster % colorPalette.length]);

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

/* ---------------------- Date Interval Selector ---------------------- */

function createDateIntervalSelector(data) {
  // Clear any previous content.
  d3.select("#date-interval-selector").html("");

  // Get the container dimensions (ensure CSS sets the width/height).
  const container = document.getElementById("date-interval-selector");
  const containerWidth = container.clientWidth || 800;   // fallback width
  const containerHeight = container.clientHeight || 150; // fallback height

  // Define margins for this chart.
  const margin = { top: 10, right: 10, bottom: 30, left: 10 };
  // Define dimensions for the chart area.
  const width = containerWidth - margin.left - margin.right;
  const height = containerHeight - margin.top - margin.bottom;

  // Append the SVG element using the container's dimensions.
  const svg = d3.select("#date-interval-selector")
    .append("svg")
    .attr("width", containerWidth)
    .attr("height", containerHeight)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Add an instruction text to guide the user.
  svg.append("text")
    .attr("class", "brush-instruction")
    .attr("x", width / 2)
    .attr("y", 5)
    .attr("text-anchor", "middle")
    .attr("fill", "#666")
    .style("font-size", "12px")
    .text("Drag over the area to select a date range");

  // Set the x-scale domain to always start at January 1, 1990.
  const minDate = new Date("1990-01-01");
  const maxDate = d3.max(data, d => d.track_album_release_date);
  const x = d3.scaleTime()
    .domain([minDate, maxDate])
    .range([0, width]);

  // Bin the data by month (adjust thresholds as needed).
  const binGenerator = d3.bin()
    .domain(x.domain())
    .value(d => d.track_album_release_date)
    .thresholds(x.ticks(d3.timeMonth));
  const bins = binGenerator(data);

  // Create the y-scale based on the bin counts.
  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length)])
    .range([height, 0]);

  // Append the x-axis.
  svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x));

  // Define and draw the area.
  const area = d3.area()
    .x(d => x(d.x0))
    .y0(height)
    .y1(d => y(d.length));

  svg.append("path")
    .datum(bins)
    .attr("fill", "#69b3a2")
    .attr("d", area);

  // Add a brush to allow date range selection.
  const brush = d3.brushX()
    .extent([[0, 0], [width, height]])
    .on("end", brushEnded);

  // Append the brush group and set its initial selection to the full range.
  const brushGroup = svg.append("g")
    .attr("class", "brush")
    .call(brush);
  brushGroup.call(brush.move, [width - width * 0.1, width]); // Default: small portion at the start selected

  function brushEnded({ selection }) {
    if (!selection) {
      selectedDateRange = null;
      applyFilters(false); // Date brush cleared: do not refresh the interval selector.
      return;
    }
    // Convert the pixel coordinates to dates.
    const [x0, x1] = selection.map(x.invert);
    selectedDateRange = [x0, x1];
    console.log("Selected date range:", selectedDateRange);
    applyFilters(false); // When selecting a date, do not refresh the interval selector.
  }
}

/* ---------------------- Filtering Functions ---------------------- */

function createFilters(dataForFilters) {
  const genreFilterDiv = document.getElementById('genre-filters');
  const artistFilterDiv = document.getElementById('artist-filters');
  genreFilterDiv.innerHTML = "";
  artistFilterDiv.innerHTML = "";

  const genres = Array.from(new Set(dataForFilters.map(d => d.playlist_genre)));

  const artistSet = new Set();
  dataForFilters.forEach(d => {
    splitArtists(d.track_artist).forEach(artist => artistSet.add(artist));
  });
  const artists = Array.from(artistSet);

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

function applyFilters(refreshDateInterval = true, refreshScatterplot = true) {
  const genreFilterDiv = document.getElementById('genre-filters');
  const artistFilterDiv = document.getElementById('artist-filters');

  const selectedGenres = Array.from(
    genreFilterDiv.querySelectorAll('input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  const selectedArtists = Array.from(
    artistFilterDiv.querySelectorAll('input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  // Start with the full dataset; if a cluster is selected, filter by it.
  let filteredData = data;
  if (selectedCluster !== null) {
    filteredData = filteredData.filter(d => d.cluster === selectedCluster);
  }

  let fullRangeData = filteredData;
  // Apply the date range filter if set.
  if (selectedDateRange) {
    filteredData = filteredData.filter(d =>
      d.track_album_release_date >= selectedDateRange[0] &&
      d.track_album_release_date <= selectedDateRange[1]
    );
  }

  // Apply genre and artist filters.
  if (selectedGenres.length > 0) {
    filteredData = filteredData.filter(d => selectedGenres.includes(d.playlist_genre));
    fullRangeData = fullRangeData.filter(d => selectedGenres.includes(d.playlist_genre));
  }
  if (selectedArtists.length > 0) {
    filteredData = filteredData.filter(d => {
      const artists = splitArtists(d.track_artist);
      return artists.some(artist => selectedArtists.includes(artist));
    });
    fullRangeData = fullRangeData.filter(d => {
      const artists = splitArtists(d.track_artist);
      return artists.some(artist => selectedArtists.includes(artist));
    });
  }

  // Update other visualizations.
  updateBarChart(filteredData, d3.select("#barchart-container svg g"), selectedCluster);
  updateClusterInfo(filteredData, selectedCluster);
  updatePopularityCharts(filteredData);
  updateTopTracksChart(filteredData);

  // Instead of re-rendering the scatterplot, update the opacity of its dots.
  d3.selectAll(".scatter-circle")
    .attr("opacity", d => filteredData.includes(d) ? 1 : 0.3);

  // Refresh the date interval selector if the flag is true.
  if (refreshDateInterval) {
    d3.select("#date-interval-selector").html("");
    createDateIntervalSelector(fullRangeData);
  }

  // Show the reset view button if any filter is applied.
  const resetButton = document.getElementById("reset-view");
  if (selectedCluster !== null || selectedDateRange !== null || selectedGenres.length > 0 || selectedArtists.length > 0) {
    resetButton.style.display = "block";
  } else {
    resetButton.style.display = "none";
  }
}

/* ---------------------- Other Helper Functions ---------------------- */

function splitArtists(artistString) {
  const token = "Tyler_The_Creator";
  const safeString = artistString.replace(/Tyler,\s*The\s*Creator/g, token);
  return safeString.split(/,\s*/).map(artist => artist === token ? "Tyler, The Creator" : artist);
}

function filterCheckboxes(containerId, searchValue) {
  const container = document.getElementById(containerId);
  const items = container.querySelectorAll('.checkbox-item');
  items.forEach(item => {
    const labelText = item.querySelector('label').textContent.toLowerCase();
    item.style.display = labelText.indexOf(searchValue.toLowerCase()) !== -1 ? 'flex' : 'none';
  });
}

document.getElementById('genre-search').addEventListener('input', function (e) {
  filterCheckboxes('genre-filters', e.target.value);
});
document.getElementById('artist-search').addEventListener('input', function (e) {
  filterCheckboxes('artist-filters', e.target.value);
});

function updatePopularityCharts(filteredData) {
  console.log("inside updatePopularityCharts");
  const genreMap = {};
  filteredData.forEach(d => {
    if (d.playlist_genre && d.track_popularity != null) {
      if (!genreMap[d.playlist_genre]) {
        genreMap[d.playlist_genre] = { sum: 0, count: 0 };
      }
      genreMap[d.playlist_genre].sum += +d.track_popularity;
      genreMap[d.playlist_genre].count += 1;
    }
  });
  let genreData = Object.entries(genreMap).map(([genre, obj]) => ({
    playlist_genre: genre,
    avgPopularity: obj.sum / obj.count
  }));
  genreData.sort((a, b) => b.avgPopularity - a.avgPopularity);
  genreData = genreData.slice(0, 10);

  const artistMap = {};
  filteredData.forEach(d => {
    if (d.track_artist && d.track_popularity != null) {
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
  updateTopGenresPieChart(genreData);
  updateHorizontalBarChart("#top-artists-chart", artistData, "track_artist");
}

function updateHorizontalBarChart(selector, data, labelField) {
  const container = document.querySelector(selector);
  let containerWidth = container.offsetWidth;
  let containerHeight = container.offsetHeight;
  if (containerWidth < 100) containerWidth = 300;
  if (containerHeight < 50) containerHeight = 200;

  const marginChart = { top: 2, right: 70, bottom: 20, left: 10 };
  const width = containerWidth - marginChart.left - marginChart.right;
  const height = containerHeight - marginChart.top - marginChart.bottom;

  d3.select(selector).select("svg").remove();

  const svg = d3.select(selector)
    .append("svg")
    .attr("width", containerWidth)
    .attr("height", containerHeight)
    .append("g")
    .attr("transform", `translate(${marginChart.left},${marginChart.top})`);

  const x = d3.scaleLinear().domain([0, 100]).range([0, width]);
  const y = d3.scaleBand()
    .domain(data.map(d => d[labelField]))
    .range([0, height])
    .padding(0.1);

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

  svg.selectAll(".label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("x", d => x(d.avgPopularity) + 3)
    .attr("y", d => y(d[labelField]) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .style("fill", "#fff")
    .style("font-size", "10px")
    .text(d => d[labelField]);

  svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x).ticks(4))
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "#fff");
}

function updateTopGenresPieChart(genreData) {
  // Get container dimensions for the pie chart.
  const container = document.getElementById("top-genres-chart");
  const containerWidth = container.clientWidth || 400;
  const containerHeight = container.clientHeight || 400;
  // Use the smaller dimension to set the radius.
  const radius = Math.min(containerWidth - 100, containerHeight) * 0.45;

  // Remove any existing svg.
  d3.select("#top-genres-chart").select("svg").remove();

  // Append an SVG element.
  const svg = d3.select("#top-genres-chart")
    .append("svg")
    .attr("width", containerWidth)
    .attr("height", containerHeight);

  // Append a group for the pie chart, centered slightly to the left.
  const pieGroup = svg.append("g")
    .attr("transform", `translate(${radius + 10}, ${containerHeight / 2})`);

  // Create a color scale using the custom 10-color palette.
  const color = d3.scaleOrdinal()
    .domain(genreData.map(d => d.playlist_genre))
    .range(["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"]);

  // Compute the total value to calculate percentages.
  const total = d3.sum(genreData, d => d.avgPopularity);

  // Create a pie layout generator with the value accessor.
  const pie = d3.pie()
    .value(d => d.avgPopularity)
    .sort(null);
  const data_ready = pie(genreData);

  // Create an arc generator for the slices.
  const arc = d3.arc()
    .innerRadius(0) // For a pie chart; set > 0 for a donut chart.
    .outerRadius(radius);

  // Build the pie chart: draw each slice.
  pieGroup.selectAll("path")
    .data(data_ready)
    .enter()
    .append("path")
      .attr("d", arc)
      .attr("fill", d => color(d.data.playlist_genre))
      .attr("stroke", "white")
      .style("stroke-width", "2px")
      .style("opacity", 0.9);

  // Add percentage labels further from the center of the slices.
  pieGroup.selectAll("text")
    .data(data_ready)
    .enter()
    .append("text")
      .text(d => ((d.data.avgPopularity / total) * 100).toFixed(1) + "%")
      .attr("transform", d => {
        const [x, y] = arc.centroid(d);
        // Multiply the centroid coordinates to push the label outward.
        const factor = 1.4;
        return `translate(${x * factor}, ${y * factor})`;
      })
      .style("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "white");

  // Dynamically calculate the legend offset based on container width.
  const legendOffset = containerWidth < 400 ? containerWidth * 0.30 : 100;
  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${containerWidth - legendOffset}, 20)`);

  const legendItems = legend.selectAll(".legend-item")
    .data(genreData)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * 20})`);

  legendItems.append("rect")
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", d => color(d.playlist_genre));

  legendItems.append("text")
    .attr("x", 18)
    .attr("y", 10)
    .text(d => d.playlist_genre)
    .style("font-size", "12px")
    .style("fill", "#fff");
}

function updateTopTracksChart(filteredData) {
  // Sort the filtered data by track popularity (descending)
  const sortedData = filteredData.sort((a, b) => b.track_popularity - a.track_popularity);
  
  // Take the top 10 tracks (adjust this number as needed)
  const topTracks = sortedData.slice(0, 10);
  console.log("topTracks", topTracks);

  // Get the container dimensions
  const container = document.getElementById("top-tracks-chart");
  const containerWidth = container.clientWidth || 800;
  const containerHeight = container.clientHeight || 400;
  
  // Define reduced margins for the chart area.
  const marginChart = { top: 10, right: 10, bottom: 20, left: 10 };
  const width = containerWidth - marginChart.left - marginChart.right;
  const height = containerHeight - marginChart.top - marginChart.bottom;

  // Clear any previous chart.
  d3.select("#top-tracks-chart").select("svg").remove();

  // Append the SVG element.
  const svg = d3.select("#top-tracks-chart")
    .append("svg")
    .attr("width", containerWidth)
    .attr("height", containerHeight)
    .append("g")
    .attr("transform", `translate(${marginChart.left},${marginChart.top})`);

  // Create an x-scale based on the track popularity.
  const x = d3.scaleLinear()
    .domain([0, d3.max(topTracks, d => d.track_popularity)])
    .range([0, width]);

  // Create a y-scale using track names (used for positioning the bars).
  const y = d3.scaleBand()
    .domain(topTracks.map(d => d.track_name))
    .range([0, height])
    .padding(0.1);

  // Draw the horizontal bars.
  svg.selectAll("rect")
    .data(topTracks)
    .enter()
    .append("rect")
      .attr("x", 0)
      .attr("y", d => y(d.track_name))
      .attr("width", d => x(d.track_popularity))
      .attr("height", y.bandwidth())
      .attr("fill", "#1E90FF");

  // Append text labels (track names) inside the bars.
  svg.selectAll(".track-label")
    .data(topTracks)
    .enter()
    .append("text")
      .attr("class", "track-label")
      .attr("x", d => x(d.track_popularity) / 2)  // Center horizontally inside bar.
      .attr("y", d => y(d.track_name) + y.bandwidth() / 2) // Center vertically inside bar.
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .style("font-size", "12px")
      .text(d => d.track_name);

  // Append the x-axis.
  svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x).ticks(5));

}