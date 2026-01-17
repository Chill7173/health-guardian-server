const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const OWM_API_KEY = "357826207d8cbf1ba429e17749178987"; // <--- PASTE KEY HERE
const LAT = "8.8932";
const LON = "76.6141";

let globalState = {
    dispenseCommand: false,
    schedule: { "Sun": [], "Mon": [], "Tue": [], "Wed": [], "Thu": [], "Fri": [], "Sat": [] },
    // NEW: Tracking Status
    lastDoseStatus: "No doses yet", 
    lastDoseTime: "--:--"
};

async function getAQI() {
    try {
        const url = `http://api.openweathermap.org/data/2.5/air_pollution?lat=${LAT}&lon=${LON}&appid=${OWM_API_KEY}`;
        const response = await axios.get(url);
        return response.data.list[0];
    } catch (error) { return null; }
}

app.get('/', async (req, res) => {
    const aqiData = await getAQI();
    let aqiStatus = "Unknown";
    let aqiColor = "gray";
    let pm25 = 0;

    if (aqiData) {
        pm25 = aqiData.components.pm2_5;
        if (aqiData.main.aqi >= 4) { aqiColor = "#e74c3c"; aqiStatus = "Hazardous"; } // Red
        else { aqiColor = "#27ae60"; aqiStatus = "Good"; } // Green
    }

    // Status Color Logic
    let statusColor = "#7f8c8d"; // Gray
    if (globalState.lastDoseStatus.includes("TAKEN")) statusColor = "#27ae60"; // Green
    if (globalState.lastDoseStatus.includes("MISSED")) statusColor = "#c0392b"; // Red
    if (globalState.lastDoseStatus.includes("WAITING")) statusColor = "#f39c12"; // Orange

    // Schedule HTML
    let scheduleHtml = '';
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    days.forEach(day => {
        let times = globalState.schedule[day].join(", ");
        scheduleHtml += `<div class="day-row"><strong>${day}:</strong> ${times || "-"}</div>`;
    });

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: 'Segoe UI', sans-serif; background: #eef2f3; text-align: center; padding: 10px; }
            .card { background: white; padding: 20px; margin: 15px auto; max-width: 450px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
            .btn { background: #3498db; color: white; padding: 10px 20px; border: none; border-radius: 6px; margin: 5px; cursor: pointer; }
            .status-box { font-size: 20px; font-weight: bold; color: white; background: ${statusColor}; padding: 15px; border-radius: 8px; margin-bottom: 10px; }
            .aqi-val { font-size: 28px; font-weight: bold; color: ${aqiColor}; }
            input, select { padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
            .day-row { text-align: left; padding: 8px; border-bottom: 1px solid #eee; font-size: 14px; }
        </style>
    </head>
    <body>
        <h1>IoT Health Guardian</h1>

        <div class="card">
            <h2>Medication Tracker</h2>
            <div class="status-box">${globalState.lastDoseStatus}</div>
            <p>Last Activity: ${globalState.lastDoseTime}</p>
        </div>

        <div class="card">
            <h2>Environment</h2>
            <div class="aqi-val">${aqiStatus}</div>
            <p>PM2.5 Level: ${pm25} µg/m³</p>
        </div>

        <div class="card">
            <h2>Weekly Schedule</h2>
            <div style="height: 150px; overflow-y: auto; margin-bottom: 15px; border: 1px solid #eee;">
                ${scheduleHtml}
            </div>
            <form action="/add-schedule" method="POST">
                <select name="day">
                    <option value="Mon">Mon</option><option value="Tue">Tue</option><option value="Wed">Wed</option>
                    <option value="Thu">Thu</option><option value="Fri">Fri</option><option value="Sat">Sat</option><option value="Sun">Sun</option>
                </select>
                <input type="time" name="time" required>
                <button class="btn">Add</button>
            </form>
             <form action="/trigger-dispense" method="POST" style="margin-top:10px">
                <button class="btn" style="background:#e74c3c">Force Dispense</button>
            </form>
        </div>
    </body>
    </html>
    `);
});

// --- API ENDPOINTS ---
app.post('/trigger-dispense', (req, res) => { globalState.dispenseCommand = true; res.redirect('/'); });

app.post('/add-schedule', (req, res) => {
    const { day, time } = req.body;
    if (day && time && !globalState.schedule[day].includes(time)) {
        globalState.schedule[day].push(time);
        globalState.schedule[day].sort();
    }
    res.redirect('/');
});

// NEW: Endpoint for ESP to update status
app.post('/api/update-status', (req, res) => {
    const { status, time } = req.body; // Expects JSON { "status": "TAKEN", "time": "14:05" }
    if(status) globalState.lastDoseStatus = status;
    if(time) globalState.lastDoseTime = time;
    console.log(`[UPDATE] Status: ${status} | Time: ${time}`);
    res.sendStatus(200);
});

app.get('/api/status', (req, res) => {
    res.json(globalState);
    if(globalState.dispenseCommand) globalState.dispenseCommand = false; 
});

app.listen(port, () => console.log(`Server on ${port}`));