// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDhYoDikZxTrlba8cS0V741Jx1n_YZHgkA",
  authDomain: "esp32-air-quality.firebaseapp.com",
  databaseURL: "https://esp32-air-quality-default-rtdb.firebaseio.com",
  projectId: "esp32-air-quality",
  storageBucket: "esp32-air-quality.appspot.com",
  messagingSenderId: "905509419713",
  appId: "1:905509419713:web:0e6d88bb120b0967247240",
  measurementId: "G-NW00VFZVJG",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Reference to all nodes
const nodesRef = database.ref("latest");
let currentNode = "AirQualityMonitor1"; // Default node
let availableNodes = [];
let currentPeriod = "week"; // Default period

// Charts
let aqiGauge;
let sensorCharts = {};
let refreshInterval;
let refreshRate = 10; // Default refresh rate in seconds

// DOM elements
const elements = {
  lastUpdated: document.getElementById("last-updated"),
  currentDate: document.getElementById("current-date"),
  aqiValue: document.getElementById("aqi-value"),
  aqiStatus: document.getElementById("aqi-status"),
  tempValue: document.getElementById("temp-value"),
  tempBar: document.getElementById("temp-bar"),
  humValue: document.getElementById("hum-value"),
  humBar: document.getElementById("hum-bar"),
  co2Value: document.getElementById("co2-value"),
  co2Display: document.getElementById("co2-display"),
  co2Bar: document.getElementById("co2-bar"),
  pm25Value: document.getElementById("pm25-value"),
  pm25Bar: document.getElementById("pm25-bar"),
  pm10Value: document.getElementById("pm10-value"),
  pm10Display: document.getElementById("pm10-display"),
  pm10Bar: document.getElementById("pm10-bar"),
  coValue: document.getElementById("co-value"),
  coDisplay: document.getElementById("co-display"),
  coBar: document.getElementById("co-bar"),
  pm1Value: document.getElementById("pm1-value"),
  pm1Bar: document.getElementById("pm1-bar"),
  ch4Value: document.getElementById("ch4-value"),
  ch4Bar: document.getElementById("ch4-bar"),
  recIcon: document.getElementById("rec-icon"),
  recTitle: document.getElementById("rec-title"),
  recText: document.getElementById("rec-text"),
};

// Chart configuration
const chartConfig = {
  temp: {
    gradient: {
      from: "rgba(255, 112, 77, 0.8)",
      to: "rgba(255, 112, 77, 0.1)",
    },
    borderColor: "rgba(255, 112, 77, 1)",
    pointBackgroundColor: "rgba(255, 112, 77, 1)",
  },
  hum: {
    gradient: {
      from: "rgba(61, 176, 255, 0.8)",
      to: "rgba(61, 176, 255, 0.1)",
    },
    borderColor: "rgba(61, 176, 255, 1)",
    pointBackgroundColor: "rgba(61, 176, 255, 1)",
  },
  co2: {
    gradient: {
      from: "rgba(255, 77, 202, 0.8)",
      to: "rgba(255, 77, 202, 0.1)",
    },
    borderColor: "rgba(255, 77, 202, 1)",
    pointBackgroundColor: "rgba(255, 77, 202, 1)",
  },
  co: {
    gradient: {
      from: "rgba(255, 170, 0, 0.8)",
      to: "rgba(255, 170, 0, 0.1)",
    },
    borderColor: "rgba(255, 170, 0, 1)",
    pointBackgroundColor: "rgba(255, 170, 0, 1)",
  },
  pm25: {
    gradient: {
      from: "rgba(160, 115, 255, 0.8)",
      to: "rgba(160, 115, 255, 0.1)",
    },
    borderColor: "rgba(160, 115, 255, 1)",
    pointBackgroundColor: "rgba(160, 115, 255, 1)",
  },
  pm10: {
    gradient: {
      from: "rgba(82, 113, 255, 0.8)",
      to: "rgba(82, 113, 255, 0.1)",
    },
    borderColor: "rgba(82, 113, 255, 1)",
    pointBackgroundColor: "rgba(82, 113, 255, 1)",
  },
};

// Initialize the dashboard
function initDashboard() {
  // Set current date
  updateCurrentDate();

  // Initialize charts
  initAqiGauge();
  initSensorCharts();

  // Fetch available nodes
  fetchAvailableNodes();

  // Add event listeners for time period buttons
  document.querySelectorAll(".btn-period").forEach((button) => {
    button.addEventListener("click", (e) => {
      document.querySelectorAll(".btn-period").forEach((btn) => {
        btn.classList.remove("active");
      });
      e.target.classList.add("active");
      currentPeriod = e.target.dataset.period;
      fetchHistoricalData(currentPeriod);
    });
  });

  // Add click event to sensor cards for highlighting
  document.querySelectorAll(".sensor-card").forEach((card) => {
    card.addEventListener("click", () => {
      const sensorId = card.dataset.sensor;
      highlightChart(sensorId);
    });
  });
}

// Update current date display
function updateCurrentDate() {
  const now = new Date();
  if (elements.currentDate) {
    elements.currentDate.textContent = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

// Function to fetch all available nodes
function fetchAvailableNodes() {
  nodesRef.once("value").then((snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    availableNodes = Object.keys(data);

    // Create node selector dropdown
    const nodeSelector = document.getElementById("node-selector");
    if (!nodeSelector) return;

    nodeSelector.innerHTML = "";

    availableNodes.forEach((node) => {
      const option = document.createElement("option");
      option.value = node;
      option.textContent = node;
      if (node === currentNode) {
        option.selected = true;
      }
      nodeSelector.appendChild(option);
    });

    // Initialize with the first node
    if (availableNodes.length > 0) {
      if (!currentNode || !availableNodes.includes(currentNode)) {
        currentNode = availableNodes[0];
      }
      setupRealtimeListener();
      fetchHistoricalData(currentPeriod);
    }

    // Add change event listener to node selector
    nodeSelector.addEventListener("change", function () {
      changeNode(this.value);
    });
  });
}

// Function to change the current node
function changeNode(nodeName) {
  currentNode = nodeName;
  setupRealtimeListener();
  fetchHistoricalData(currentPeriod);
}

// Highlight a specific chart when its sensor card is clicked
function highlightChart(sensorId) {
  const chartElement = document.getElementById(`${sensorId}-chart`);
  if (!chartElement) return;

  const chartContainer = chartElement.closest(".chart-container");
  if (!chartContainer) return;

  // Remove highlight from all chart containers
  document.querySelectorAll(".chart-container").forEach((container) => {
    container.style.boxShadow = "";
  });

  // Apply highlight
  chartContainer.style.boxShadow = `0 0 0 2px var(--${sensorId}-color)`;

  // Scroll to the chart
  chartContainer.scrollIntoView({ behavior: "smooth", block: "center" });
}

// Set up real-time data listener
function setupRealtimeListener() {
  // Clear any existing interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  // Remove any existing listeners
  if (window.currentDataRef) {
    window.currentDataRef.off();
  }

  // Initial data fetch
  fetchLatestData();

  // Set up interval for periodic refresh
  refreshInterval = setInterval(fetchLatestData, refreshRate * 1000);
}

// Function to fetch latest data
function fetchLatestData() {
  database
    .ref(`latest/${currentNode}`)
    .once("value")
    .then((snapshot) => {
      const data = snapshot.val();
      if (data) {
        updateDashboard(data);
      }
    });
}

// Initialize AQI gauge - New Version
function initAqiGauge() {
  const ctx = document.getElementById("aqi-gauge");
  if (!ctx) return;

  aqiGauge = new Chart(ctx.getContext("2d"), {
    type: "doughnut",
    data: {
      datasets: [
        {
          data: [0, 100],
          backgroundColor: [createAqiGradient(ctx), "rgba(0, 0, 0, 0.05)"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      cutout: "75%",
      circumference: 180,
      rotation: 270,
      plugins: {
        tooltip: {
          enabled: false,
        },
        legend: {
          display: false,
        },
      },
      animation: {
        animateRotate: true,
        animateScale: true,
      },
    },
  });
}

// Create colorful gradient for AQI gauge
function createAqiGradient(ctx) {
  const gradient = ctx.getContext("2d").createLinearGradient(0, 0, 200, 0);
  gradient.addColorStop(0, "#00e400"); // Good
  gradient.addColorStop(0.2, "#ffff00"); // Moderate
  gradient.addColorStop(0.4, "#ff7e00"); // Unhealthy for Sensitive Groups
  gradient.addColorStop(0.6, "#ff0000"); // Unhealthy
  gradient.addColorStop(0.8, "#8f3f97"); // Very Unhealthy
  gradient.addColorStop(1, "#7e0023"); // Hazardous
  return gradient;
}

// Initialize sensor charts - UPDATED with fixes for y-axis overflow
function initSensorCharts() {
  const sensors = ["temp", "hum", "co2", "co", "pm25", "pm10"];

  sensors.forEach((sensorId) => {
    const ctx = document.getElementById(`${sensorId}-chart`);
    if (!ctx) return;

    const config = chartConfig[sensorId];

    sensorCharts[sensorId] = new Chart(ctx.getContext("2d"), {
      type: "line",
      data: {
        datasets: [
          {
            label: sensorNameFromId(sensorId),
            data: [],
            borderColor: config.borderColor,
            backgroundColor: function (context) {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) {
                // This case happens on initial chart load
                return null;
              }

              // Create gradient
              const gradient = ctx.createLinearGradient(
                0,
                chartArea.bottom,
                0,
                chartArea.top
              );
              gradient.addColorStop(0, config.gradient.to);
              gradient.addColorStop(1, config.gradient.from);
              return gradient;
            },
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: config.pointBackgroundColor,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            mode: "index",
            intersect: false,
            backgroundColor: "rgba(20, 20, 30, 0.9)",
            titleColor: "#fff",
            bodyColor: "#fff",
            borderColor: "rgba(255, 255, 255, 0.2)",
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            titleFont: {
              size: 14,
              weight: "bold",
            },
            bodyFont: {
              size: 13,
            },
            displayColors: false,
          },
        },
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            type: "time",
            time: {
              unit: "day",
              displayFormats: {
                hour: "HH:mm",
                day: "MMM DD",
                week: "MMM DD",
                month: "MMM YYYY",
              },
              tooltipFormat: "YYYY-MM-DD HH:mm:ss",
            },
            grid: {
              display: true,
              color: "rgba(0, 0, 0, 0.1)",
            },
            ticks: {
              color: "rgba(0, 0, 0, 0.7)",
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 6,
              font: {
                size: 12,
              },
            },
            border: {
              color: "rgba(0, 0, 0, 0.1)",
            },
          },
          y: {
            beginAtZero: true,
            grace: "5%", // Add padding to prevent values from touching the top
            grid: {
              display: true,
              color: "rgba(0, 0, 0, 0.1)",
            },
            ticks: {
              color: "rgba(0, 0, 0, 0.7)",
              font: {
                size: 12,
              },
              maxTicksLimit: 6,
              padding: 5, // Add padding to y-axis ticks
            },
            border: {
              color: "rgba(0, 0, 0, 0.1)",
            },
          },
        },
        layout: {
          padding: {
            top: 10, // Add padding to the top
            right: 10,
            bottom: 5,
            left: 5,
          },
        },
        animation: {
          duration: 1000,
        },
      },
    });
  });
}

// Get sensor name from ID
function sensorNameFromId(id) {
  const names = {
    temp: "Temperature",
    hum: "Humidity",
    co2: "CO₂",
    co: "CO",
    pm25: "PM2.5",
    pm10: "PM10",
    pm1: "PM1",
    ch4: "CH₄",
  };
  return names[id] || id;
}

// Update dashboard with latest data
function updateDashboard(data) {
  if (!data) return;

  // Update last updated time
  const timestamp = parseTimestamp(data.ts);
  if (elements.lastUpdated) {
    elements.lastUpdated.textContent = timestamp.toLocaleTimeString();
  }

  // Update temperature
  if (elements.tempValue)
    elements.tempValue.textContent = `${data.temp.toFixed(1)}°C`;
  if (elements.tempBar)
    elements.tempBar.style.width = `${Math.min(data.temp * 2, 100)}%`;

  // Update humidity
  if (elements.humValue)
    elements.humValue.textContent = `${data.hum.toFixed(1)}%`;
  if (elements.humBar)
    elements.humBar.style.width = `${Math.min(data.hum, 100)}%`;

  // Update CO₂
  if (elements.co2Value)
    elements.co2Value.textContent = `${data.co2.toFixed(0)} ppm`;
  if (elements.co2Display)
    elements.co2Display.textContent = `${data.co2.toFixed(0)} ppm`;
  if (elements.co2Bar)
    elements.co2Bar.style.width = `${Math.min(data.co2 / 20, 100)}%`;

  // Update PM2.5
  if (elements.pm25Value)
    elements.pm25Value.textContent = `${data.pm25.toFixed(1)} µg/m³`;
  if (elements.pm25Bar)
    elements.pm25Bar.style.width = `${Math.min(data.pm25 * 2, 100)}%`;

  // Update PM10
  if (elements.pm10Value)
    elements.pm10Value.textContent = `${data.pm10.toFixed(1)} µg/m³`;
  if (elements.pm10Display)
    elements.pm10Display.textContent = `${data.pm10.toFixed(1)} µg/m³`;
  if (elements.pm10Bar)
    elements.pm10Bar.style.width = `${Math.min(data.pm10, 100)}%`;

  // Update CO
  if (elements.coValue)
    elements.coValue.textContent = `${data.co.toFixed(2)} ppm`;
  if (elements.coDisplay)
    elements.coDisplay.textContent = `${data.co.toFixed(2)} ppm`;
  if (elements.coBar)
    elements.coBar.style.width = `${Math.min(data.co * 20, 100)}%`;

  // Update PM1
  if (elements.pm1Value)
    elements.pm1Value.textContent = `${data.pm1.toFixed(1)} µg/m³`;
  if (elements.pm1Bar)
    elements.pm1Bar.style.width = `${Math.min(data.pm1 * 2, 100)}%`;

  // Update CH4
  if (elements.ch4Value)
    elements.ch4Value.textContent = `${data.ch4.toFixed(2)} ppm`;
  if (elements.ch4Bar)
    elements.ch4Bar.style.width = `${Math.min(data.ch4 * 20, 100)}%`;

  // Calculate AQI (simplified calculation based on PM2.5)
  const aqi = calculateAQI(data.pm25);
  if (elements.aqiValue) {
    elements.aqiValue.textContent = aqi;
  }

  // Update AQI info
  updateAqiInfo(aqi);
}

// Parse timestamp string in format "YYYY-MM-DD HH:MM:SS"
function parseTimestamp(timestampStr) {
  // Split the date and time parts
  const [datePart, timePart] = timestampStr.split(" ");
  const [year, month, day] = datePart.split("-");
  const [hour, minute, second] = timePart.split(":");

  // JavaScript months are 0-based, so subtract 1 from the month
  return new Date(year, month - 1, day, hour, minute, second);
}

// Calculate AQI based on PM2.5 (simplified)
function calculateAQI(pm25) {
  if (pm25 <= 12) {
    return Math.round(((50 - 0) / (12 - 0)) * (pm25 - 0) + 0);
  } else if (pm25 <= 35.4) {
    return Math.round(((100 - 51) / (35.4 - 12.1)) * (pm25 - 12.1) + 51);
  } else if (pm25 <= 55.4) {
    return Math.round(((150 - 101) / (55.4 - 35.5)) * (pm25 - 35.5) + 101);
  } else if (pm25 <= 150.4) {
    return Math.round(((200 - 151) / (150.4 - 55.5)) * (pm25 - 55.5) + 151);
  } else if (pm25 <= 250.4) {
    return Math.round(((300 - 201) / (250.4 - 150.5)) * (pm25 - 150.5) + 201);
  } else if (pm25 <= 350.4) {
    return Math.round(((400 - 301) / (350.4 - 250.5)) * (pm25 - 250.5) + 301);
  } else {
    return Math.round(((500 - 401) / (500.4 - 350.5)) * (pm25 - 350.5) + 401);
  }
}

// Update AQI information including status, color, and recommendations
function updateAqiInfo(aqi) {
  // Update gauge
  if (aqiGauge) {
    const percentage = Math.min(aqi / 500, 1);
    aqiGauge.data.datasets[0].data = [percentage * 100, 100 - percentage * 100];
    aqiGauge.update();
  }

  // Update status and recommendations
  const aqiStatus = elements.aqiStatus;
  const recIcon = elements.recIcon;
  const recTitle = elements.recTitle;
  const recText = elements.recText;

  if (aqi <= 50) {
    if (aqiStatus) {
      aqiStatus.textContent = "Good";
      aqiStatus.style.backgroundColor = "var(--good-color)";
      aqiStatus.style.color = "#000";
    }

    if (recIcon) recIcon.innerHTML = '<i class="bi bi-check-circle"></i>';
    if (recTitle) recTitle.textContent = "Good Air Quality";
    if (recText)
      recText.textContent =
        "Air quality is considered satisfactory, and air pollution poses little or no risk.";
  } else if (aqi <= 100) {
    if (aqiStatus) {
      aqiStatus.textContent = "Moderate";
      aqiStatus.style.backgroundColor = "var(--moderate-color)";
      aqiStatus.style.color = "#000";
    }

    if (recIcon) recIcon.innerHTML = '<i class="bi bi-exclamation-circle"></i>';
    if (recTitle) recTitle.textContent = "Moderate Air Quality";
    if (recText)
      recText.textContent =
        "Air quality is acceptable; however, sensitive individuals may experience mild effects.";
  } else if (aqi <= 150) {
    if (aqiStatus) {
      aqiStatus.textContent = "Unhealthy for Sensitive Groups";
      aqiStatus.style.backgroundColor = "var(--unhealthy-sg-color)";
      aqiStatus.style.color = "#fff";
    }

    if (recIcon)
      recIcon.innerHTML = '<i class="bi bi-exclamation-triangle"></i>';
    if (recTitle) recTitle.textContent = "Unhealthy for Sensitive Groups";
    if (recText)
      recText.textContent =
        "Members of sensitive groups may experience health effects. The general public is not likely to be affected.";
  } else if (aqi <= 200) {
    if (aqiStatus) {
      aqiStatus.textContent = "Unhealthy";
      aqiStatus.style.backgroundColor = "var(--unhealthy-color)";
      aqiStatus.style.color = "#fff";
    }

    if (recIcon)
      recIcon.innerHTML = '<i class="bi bi-exclamation-triangle"></i>';
    if (recTitle) recTitle.textContent = "Unhealthy Air Quality";
    if (recText)
      recText.textContent =
        "Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.";
  } else {
    if (aqiStatus) {
      aqiStatus.textContent = "Very Unhealthy";
      aqiStatus.style.backgroundColor = "var(--very-unhealthy-color)";
      aqiStatus.style.color = "#fff";
    }

    if (recIcon)
      recIcon.innerHTML = '<i class="bi bi-exclamation-triangle"></i>';
    if (recTitle) recTitle.textContent = "Very Unhealthy Air Quality";
    if (recText)
      recText.textContent =
        "Health warnings of emergency conditions. The entire population is more likely to be affected.";
  }
}

// Fetch historical data for all sensor charts
function fetchHistoricalData(period) {
  let limitCount;
  let intervalMinutes;

  switch (period) {
    case "day":
      limitCount = 24 * 10; // 24 hours with 10 readings per hour
      intervalMinutes = 6;
      break;
    case "week":
      limitCount = 7 * 24; // 7 days with hourly readings
      intervalMinutes = 60;
      break;
    case "month":
      limitCount = 30 * 6; // 30 days with 6 readings per day
      intervalMinutes = 240;
      break;
    default:
      limitCount = 7 * 24;
      intervalMinutes = 60;
  }

  const historicalDataRef = database.ref(`data/${currentNode}`);

  // Get all data for the current node
  historicalDataRef
    .once("value")
    .then((snapshot) => {
      const data = snapshot.val();
      if (!data) {
        console.log("No historical data found");
        return;
      }

      // Process data - convert Unix timestamp keys to data points
      const chartData = {
        temp: [],
        hum: [],
        co2: [],
        co: [],
        pm25: [],
        pm10: [],
      };

      Object.keys(data).forEach((timestampKey) => {
        const entry = data[timestampKey];

        // Parse the timestamp string to a Date object
        const timestamp = parseTimestamp(entry.ts);

        chartData.temp.push({
          timestamp: timestamp,
          value: entry.temp,
        });
        chartData.hum.push({
          timestamp: timestamp,
          value: entry.hum,
        });
        chartData.co2.push({
          timestamp: timestamp,
          value: entry.co2,
        });
        chartData.co.push({
          timestamp: timestamp,
          value: entry.co,
        });
        chartData.pm25.push({
          timestamp: timestamp,
          value: entry.pm25,
        });
        chartData.pm10.push({
          timestamp: timestamp,
          value: entry.pm10,
        });
      });

      // Sort by timestamp (ascending)
      const sortByTimestamp = (a, b) => a.timestamp - b.timestamp;
      chartData.temp.sort(sortByTimestamp);
      chartData.hum.sort(sortByTimestamp);
      chartData.co2.sort(sortByTimestamp);
      chartData.co.sort(sortByTimestamp);
      chartData.pm25.sort(sortByTimestamp);
      chartData.pm10.sort(sortByTimestamp);

      // Calculate time range based on period
      const now = new Date();
      const endTime = now.getTime();
      const startTime = endTime - limitCount * intervalMinutes * 60 * 1000;

      // Filter data to the selected time range
      const filterByTimeRange = (item) =>
        item.timestamp.getTime() >= startTime &&
        item.timestamp.getTime() <= endTime;

      const filteredTemp = chartData.temp.filter(filterByTimeRange);
      const filteredHum = chartData.hum.filter(filterByTimeRange);
      const filteredCO2 = chartData.co2.filter(filterByTimeRange);
      const filteredCO = chartData.co.filter(filterByTimeRange);
      const filteredPM25 = chartData.pm25.filter(filterByTimeRange);
      const filteredPM10 = chartData.pm10.filter(filterByTimeRange);

      // Sample data at regular intervals to reduce data points
      const sampledTemp = sampleDataByInterval(filteredTemp, intervalMinutes);
      const sampledHum = sampleDataByInterval(filteredHum, intervalMinutes);
      const sampledCO2 = sampleDataByInterval(filteredCO2, intervalMinutes);
      const sampledCO = sampleDataByInterval(filteredCO, intervalMinutes);
      const sampledPM25 = sampleDataByInterval(filteredPM25, intervalMinutes);
      const sampledPM10 = sampleDataByInterval(filteredPM10, intervalMinutes);

      // Update charts
      updateChart("temp", sampledTemp, period);
      updateChart("hum", sampledHum, period);
      updateChart("co2", sampledCO2, period);
      updateChart("co", sampledCO, period);
      updateChart("pm25", sampledPM25, period);
      updateChart("pm10", sampledPM10, period);
    })
    .catch((error) => {
      console.error("Error fetching historical data:", error);
    });
}

// Sample data at regular intervals to reduce data points
function sampleDataByInterval(data, intervalMinutes) {
  if (data.length === 0) return [];

  const result = [];

  let lastTimestamp = null;
  const intervalMs = intervalMinutes * 60 * 1000;

  data.forEach((item) => {
    if (
      lastTimestamp === null ||
      item.timestamp.getTime() - lastTimestamp >= intervalMs
    ) {
      result.push({
        x: item.timestamp,
        y: item.value,
      });
      lastTimestamp = item.timestamp.getTime();
    }
  });

  return result;
}

// Update chart with the fetched data
function updateChart(sensorId, data, period) {
  if (!sensorCharts[sensorId]) return;

  // Update chart data
  sensorCharts[sensorId].data.datasets[0].data = data;

  // Update chart options for time scale
  sensorCharts[sensorId].options.scales.x.time.unit = getTimeUnit(period);

  sensorCharts[sensorId].update();
}

// Get appropriate time unit based on period
function getTimeUnit(period) {
  switch (period) {
    case "day":
      return "hour";
    case "week":
      return "day";
    case "month":
      return "week";
    default:
      return "day";
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener("DOMContentLoaded", initDashboard);
