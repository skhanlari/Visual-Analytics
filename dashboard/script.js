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

let scatter, bar, selectedCluster;
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
  });

  const normalize = (val, min, max) => (val - min) / (max - min);
  const minLoudness = d3.min(data, d => d.loudness), maxLoudness = d3.max(data, d => d.loudness);
  data.forEach(d => d.loudness = normalize(d.loudness, minLoudness, maxLoudness));

  const scatterSvg = createScatterplot(data);
  const barSvg = createBarchart();
  updateBarChart(data, barSvg, null);
  updateClusterInfo(data, null);

  document.getElementById("reset-view").addEventListener("click", () => {
    selectedCluster = null;
    updateBarChart(data, barSvg, null);
    updateClusterInfo(data, null);
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
      updateBarChart(data, d3.select("#barchart-container svg g"), selectedCluster);
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
  const filteredData = cluster !== null ? data.filter(d => d.cluster === cluster) : data;
  const averages = Object.fromEntries(audioFeatures.map(f => [f, d3.mean(filteredData, d => d[f])]))

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
    danceability: d3.mean(data, d => d.danceability).toFixed(2),
    energy: d3.mean(data, d => d.energy).toFixed(2),
    valence: d3.mean(data, d => d.valence).toFixed(2),
    loudness: d3.mean(data, d => d.loudness).toFixed(2),
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
    danceability: d3.mean(clusterSongs, d => d.danceability).toFixed(2),
    energy: d3.mean(clusterSongs, d => d.energy).toFixed(2),
    valence: d3.mean(clusterSongs, d => d.valence).toFixed(2),
    loudness: d3.mean(clusterSongs, d => d.loudness).toFixed(2),
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

