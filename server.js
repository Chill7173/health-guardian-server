const express = require('express');
const axios = require('axios'); // You might need to run: npm install axios
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CONFIGURATION ---
const OWM_API_KEY = "YOUR_OWM_API_KEY"; // <--- PASTE YOUR API KEY HERE
const LAT = "8.8932"; // Kollam
const LON = "76.6141";

// --- MEMORY DATABASE ---
let globalState = {
    dispenseCommand: false,
    // Default Schedule: Empty arrays for each day
    schedule: {
        "Sun": [], "Mon": [], "Tue": [], "Wed": [], "Thu": [], "Fri": [], "Sat": []
    }
};

// --- HELPER: GET AQI ---
async function getAQI() {
    try {
        const url = `http://api.openweathermap.org/data/2.5/air_pollution?lat=${LAT}&lon=${LON}&appid=${OWM_API_KEY}`;
        const response = await axios.get(url);
        return response.data.list[0]; // Returns full AQI object
    } catch (error) {
        console.error("AQI Error", error);
        return null;
    }
}

// --- 1. THE DASHBOARD (UI) ---
app.get('/', async (req, res) => {
    const aqiData = await getAQI();
    let aqiColor = "green";
    let aqiStatus = "Good";
    let pm25 = 0;
    
    if (aqiData) {
        pm25 = aqiData.components.pm2_5;
        if (aqiData.main.aqi >= 4) { aqiColor = "red"; aqiStatus = "Hazardous"; }
        else if (aqiData.main.aqi == 3) { aqiColor = "orange"; aqiStatus = "Moderate"; }
    }

    // Build Schedule HTML
    let scheduleHtml = '';
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    days.forEach(day => {
        let times = globalState.schedule[day].join(", ");
        scheduleHtml += `<div class="day-row"><strong>${day}:</strong> ${times || "No doses"}</div>`;
    });

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: 'Segoe UI', sans-serif; background: #f4f7f6; text-align: center; padding: 20px; }
            .card { background: white; padding: 20px; margin: 15px auto; max-width: 500px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
            h2 { border-bottom: 2px solid #eee; padding-bottom: 10px; color: #333; }
            .btn { background: #3498db; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; margin: 5px; }
            .btn-red { background: #e74c3c; }
            .aqi-box { font-size: 24px; font-weight: bold; color: ${aqiColor}; margin: 10px 0; }
            .day-row { text-align: left; padding: 8px; border-bottom: 1px solid #eee; }
            select, input { padding: 8px; border-radius: 4px; border: 1px solid #ddd; }
        </style>
    </head>
    <body>
        <h1>IoT Health Guardian</h1>

        <div class="card">
            <h2>Live Air Quality</h2>
            <div class="aqi-box">${aqiStatus} (Level ${aqiData ? aqiData.main.aqi : '-'})</div>
            <p>PM2.5: <strong>${pm25} µg/m³</strong></p>
        </div>

        <div class="card">
            <h2>Manual Control</h2>
            <form action="/trigger-dispense" method="POST">
                <button class="btn btn-red">DISPENSE PILL NOW</button>
            </form>
        </div>

        <div class="card">
            <h2>Weekly Schedule</h2>
            <div style="margin-bottom: 15px; max-height: 200px; overflow-y: auto;">
                ${scheduleHtml}
            </div>
            
            <h3>Add New Dose</h3>
            <form action="/add-schedule" method="POST">
                <select name="day">
                    <option value="Mon">Monday</option>
                    <option value="Tue">Tuesday</option>
                    <option value="Wed">Wednesday</option>
                    <option value="Thu">Thursday</option>
                    <option value="Fri">Friday</option>
                    <option value="Sat">Saturday</option>
                    <option value="Sun">Sunday</option>
                </select>
                <input type="time" name="time" required>
                <button class="btn">Add</button>
            </form>
            <form action="/clear-schedule" method="POST" style="margin-top:10px;">
                 <button class="btn" style="background:#7f8c8d; font-size:12px;">Clear All Schedules</button>
            </form>
        </div>
    </body>
    </html>
    `);
});

// --- API ENDPOINTS ---
app.post('/trigger-dispense', (req, res) => {
    globalState.dispenseCommand = true;
    res.redirect('/');
});

app.post('/add-schedule', (req, res) => {
    const { day, time } = req.body;
    if (day && time) {
        if (!globalState.schedule[day].includes(time)) {
            globalState.schedule[day].push(time);
            globalState.schedule[day].sort(); // Keep times in order
        }
    }
    res.redirect('/');
});

app.post('/clear-schedule', (req, res) => {
    Object.keys(globalState.schedule).forEach(key => globalState.schedule[key] = []);
    res.redirect('/');
});

// --- ESP DEVICE API ---
app.get('/api/status', (req, res) => {
    res.json(globalState);
    if(globalState.dispenseCommand) globalState.dispenseCommand = false; 
});

app.listen(port, () => console.log(`Server running on port ${port}`));