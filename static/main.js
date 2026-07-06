document.addEventListener('DOMContentLoaded', () => {
    // ─── State Variables ───────────────────────────────────────────────────
    let currentPrediction = null;
    let modelInfo = null;
    let historyData = [];

    // Chart instances
    let chartXAI = null;
    let chartRadar = null;
    let chartModelCompare = null;
    let chartHistoryTrend = null;
    let chartNormalCompare = null;

    // ─── 1. Tab Switching Logic ────────────────────────────────────────────
    window.switchTab = function(tabId) {
        // Toggle tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            const isTarget = btn.dataset.tab === tabId;
            btn.classList.toggle('active', isTarget);
            btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
        });

        // Toggle tab panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            const isTarget = panel.id === `panel-${tabId}`;
            panel.classList.toggle('active', !isTarget); // Active panels don't have .hidden
            panel.classList.toggle('hidden', !isTarget);
        });

        // Specific actions on tab entrance
        if (tabId === 'analytics') {
            renderAnalyticsCharts();
        } else if (tabId === 'history') {
            loadHistory();
        } else if (tabId === 'doctors') {
            loadDoctors();
        }
    };

    // Attach click events to tab buttons
    document.querySelectorAll('.tab-nav .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    // ─── 2. Form Sliders Live Updating ─────────────────────────────────────
    const sliders = [
        { id: 'age', valId: 'age-val' },
        { id: 'trestbps', valId: 'trestbps-val' },
        { id: 'chol', valId: 'chol-val' },
        { id: 'thalach', valId: 'thalach-val' }
    ];

    sliders.forEach(s => {
        const input = document.getElementById(s.id);
        const display = document.getElementById(s.valId);
        if (input && display) {
            input.addEventListener('input', (e) => {
                display.textContent = e.target.value;
            });
        }
    });

    // ─── 3. Toggle Buttons (Sex, FBS, ExAng) ──────────────────────────────
    setupToggleGroup('sex-group', 'sex');
    setupToggleGroup('fbs-group', 'fbs');
    setupToggleGroup('exang-group', 'exang');

    function setupToggleGroup(groupId, inputId) {
        const container = document.getElementById(groupId);
        const input = document.getElementById(inputId);
        if (!container || !input) return;

        const buttons = container.querySelectorAll('.btn-toggle');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                input.value = btn.dataset.val;
            });
        });
    }

    // ─── 4. Chest Pain Card Selector ──────────────────────────────────────
    const cpGroup = document.getElementById('cp-group');
    const cpInput = document.getElementById('cp');
    if (cpGroup && cpInput) {
        const cards = cpGroup.querySelectorAll('.selector-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                cards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                cpInput.value = card.dataset.val;
            });
        });
    }

    // ─── 5. Fetch General Model Info ──────────────────────────────────────
    async function fetchModelInfo() {
        try {
            const res = await fetch('/model-info');
            if (res.ok) {
                modelInfo = await res.json();
                updateModelBadges();
            }
        } catch (err) {
            console.error("Failed to load model info:", err);
        }
    }
    fetchModelInfo();

    function updateModelBadges() {
        const badgeText = document.getElementById('model-badge-text');
        const accBadges = document.getElementById('acc-badges');
        if (!modelInfo) return;

        if (badgeText) {
            badgeText.textContent = `${modelInfo.model_name} Engine Active (${modelInfo.accuracy}% Acc)`;
        }

        if (accBadges && modelInfo.all_accuracies) {
            accBadges.innerHTML = '';
            Object.entries(modelInfo.all_accuracies).forEach(([name, acc]) => {
                const isBest = name === modelInfo.model_name;
                const badge = document.createElement('span');
                badge.className = `acc-badge ${isBest ? 'best' : ''}`;
                badge.innerHTML = `${isBest ? '<i class="fa-solid fa-star"></i> ' : ''}${name}: ${acc}%`;
                accBadges.appendChild(badge);
            });
        }
    }

    // ─── 6. Predict Form Submission ───────────────────────────────────────
    const form = document.getElementById('prediction-form');
    const predictBtn = document.getElementById('predict-btn');
    const placeholderContainer = document.getElementById('placeholder-container');
    const resultsContainer = document.getElementById('results-container');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Set loading state on button
            predictBtn.disabled = true;
            const originalBtnHtml = predictBtn.innerHTML;
            predictBtn.innerHTML = `<span>Analyzing Cardiac Profile...</span> <i class="fa-solid fa-spinner fa-spin"></i>`;

            // Prepare payload
            const payload = {
                patient_name: document.getElementById('patient_name').value || 'Anonymous',
                diet_type: document.getElementById('diet_type').value,
                age: parseFloat(document.getElementById('age').value),
                sex: parseInt(document.getElementById('sex').value),
                cp: parseInt(document.getElementById('cp').value),
                trestbps: parseFloat(document.getElementById('trestbps').value),
                chol: parseFloat(document.getElementById('chol').value),
                fbs: parseInt(document.getElementById('fbs').value),
                thalach: parseFloat(document.getElementById('thalach').value),
                exang: parseInt(document.getElementById('exang').value)
            };

            try {
                const res = await fetch('/predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) throw new Error("Prediction API failed");

                const result = await res.json();
                currentPrediction = { inputs: payload, output: result };

                // Hide placeholder and reveal results panel
                placeholderContainer.classList.add('hidden');
                resultsContainer.classList.remove('hidden');

                // Update Risk Badge UI
                const riskBadge = document.getElementById('risk-badge');
                const riskLabelText = document.getElementById('risk-label-text');
                if (riskLabelText && riskBadge) {
                    riskLabelText.textContent = `${result.patient_name.toUpperCase()}: ${result.label.toUpperCase()}`;
                    riskBadge.style.color = result.color;
                    riskBadge.style.borderColor = result.color;
                    riskBadge.style.backgroundColor = result.background;
                }

                // Animate circular gauge
                animateGauge(result.probability, result.color);

                // Update Key Metrics summary block
                document.getElementById('metric-bp').textContent = `${payload.trestbps} mmHg`;
                document.getElementById('metric-chol').textContent = `${payload.chol} mg/dl`;
                document.getElementById('metric-hr').textContent = `${payload.thalach} bpm`;
                document.getElementById('metric-angina').textContent = payload.exang === 1 ? 'Yes' : 'No';

                // Display dynamic clinical insights & recommendations
                renderClinicalRecommendations(payload, result);

                // Update tab history counter in background
                updateHistoryCount();

            } catch (err) {
                console.error(err);
                alert("An error occurred during diagnostic prediction. Please make sure Flask is running.");
            } finally {
                predictBtn.disabled = false;
                predictBtn.innerHTML = originalBtnHtml;
            }
        });
    }

    // Gauge progress circle animation
    function animateGauge(targetPct, color) {
        const fill = document.getElementById('gauge-fill');
        const text = document.getElementById('gauge-pct');
        if (!fill || !text) return;

        const circumference = 314; // 2 * PI * 50
        fill.style.stroke = color;

        let currentPct = 0;
        const duration = 900; // ms
        const steps = 45;
        const intervalTime = duration / steps;
        const delta = targetPct / steps;

        const timer = setInterval(() => {
            currentPct += delta;
            if (currentPct >= targetPct) {
                currentPct = targetPct;
                clearInterval(timer);
            }
            text.textContent = `${currentPct.toFixed(1)}%`;
            const offset = circumference - (currentPct / 100) * circumference;
            fill.style.strokeDashoffset = offset;
        }, intervalTime);
    }

    // Generate readable feedback, Pakistani diet plan, and recommendations
    function renderClinicalRecommendations(inputs, result) {
        const textEl = document.getElementById('risk-analysis-text');
        const listEl = document.getElementById('recs-list');
        const dietPlanEl = document.getElementById('diet-plan-text');
        if (!textEl || !listEl || !dietPlanEl) return;

        let explanation = "";
        let recs = [];

        if (result.label === "High Risk") {
            explanation = `Dear <strong>${result.patient_name}</strong>, the Machine Learning engine classifies your cardiac profile as <strong>High Risk</strong> (${result.probability}% likelihood of coronary disease). `;
            
            let keyDrivers = [];
            if (inputs.exang === 1) keyDrivers.push("exercise-induced angina");
            if (inputs.cp === 0) keyDrivers.push("typical angina symptoms");
            if (inputs.trestbps > 140) keyDrivers.push(`systolic blood pressure of ${inputs.trestbps} mmHg`);
            if (inputs.chol > 240) keyDrivers.push(`elevated serum cholesterol of ${inputs.chol} mg/dl`);
            if (inputs.thalach < 120) keyDrivers.push(`low maximum heart rate limit of ${inputs.thalach} bpm`);

            if (keyDrivers.length > 0) {
                explanation += `This score is primarily driven by: ${keyDrivers.join(', ')}. `;
            } else {
                explanation += "Risk is driven by the general configuration of clinical features. ";
            }
            explanation += "We recommend scheduling a consultation with a cardiologist in Peshawar or Islamabad for further evaluation.";
        } else {
            explanation = `Dear <strong>${result.patient_name}</strong>, the model classifies your profile as <strong>Low Risk</strong> (${result.probability}% likelihood). your parameters are generally within standard ranges. `;
            if (inputs.trestbps > 130 || inputs.chol > 200) {
                explanation += "However, slightly elevated parameters indicate that minor dietary or lifestyle improvements would be beneficial.";
            } else {
                explanation += "Excellent baseline metrics. Continue maintaining your current active routine and balanced diet.";
            }
        }

        textEl.innerHTML = explanation;

        // Custom lifestyle recommendations list
        if (inputs.trestbps > 130) {
            recs.push("<strong>Manage Blood Pressure:</strong> Keep sodium below 1,500 mg/day. Limit caffeinated drinks and monitor weekly.");
        }
        if (inputs.chol > 200) {
            recs.push("<strong>Improve Lipid Profiles:</strong> Focus on fiber-rich oats, nuts, and healthy fats (olive oil). Restrict red meat.");
        }
        if (inputs.thalach < 130 && result.label === "High Risk") {
            recs.push("<strong>Exercise Safety:</strong> Avoid sudden intense exertion. Opt for brisk walking, and consult a doctor first.");
        } else {
            recs.push("<strong>Maintain Conditioning:</strong> Aim for 150 minutes of moderate aerobic workouts (cycling, walking) weekly.");
        }
        if (result.label === "High Risk") {
            recs.push("<strong>Cardiologist Review:</strong> Schedule a cardiac stress test or 12-lead ECG with a specialist.");
        } else {
            recs.push("<strong>Preventative Check:</strong> Conduct routine fasting lipid panels once a year to track progress.");
        }

        listEl.innerHTML = recs.map(r => `<li>${r}</li>`).join('');

        // ─── Dynamic Pakistan-Focused Diet Plan ──────────────────────────────────
        let dietHtml = "";
        const isHighRisk = result.label === "High Risk";
        const hasHighChol = inputs.chol > 200;
        const hasHighBP = inputs.trestbps > 130;

        if (inputs.diet_type === "Desi / High-Fat") {
            dietHtml += `<strong>Current Diet:</strong> Heavy South Asian/Desi cooking style (rich in oil, ghee, and meat).<br><br>`;
            if (isHighRisk || hasHighChol || hasHighBP) {
                dietHtml += `⚠️ <strong>Dietary Modifications Required:</strong><br>`;
                dietHtml += `• <strong>Reduce Ghee &amp; Butter:</strong> Switch from Dalda/Ghee to minimal liquid oils (Canola or Sunflower oil) for cooking salans. Limit to 1 teaspoon per person per meal.<br>`;
                dietHtml += `• <strong>Swap Red Meat:</strong> Avoid mutton/beef karahi, nihari, and paya. Instead, opt for boiled or grilled skinless chicken or trout/mushka fish (baked, not deep-fried).<br>`;
                dietHtml += `• <strong>Replace Parathas:</strong> Eliminate ghee parathas for breakfast. Eat dry whole-wheat tandoori rotis or multi-grain flatbreads with low-fat yogurt (dahi) or egg whites.<br>`;
                dietHtml += `• <strong>Add Soluble Fiber:</strong> Take 1-2 tablespoons of <i>Ispaghol (Psyllium Husk)</i> mixed in water daily before dinner to lower cholesterol levels naturally.`;
            } else {
                dietHtml += `👍 <strong>Preventative Advice:</strong><br>`;
                dietHtml += `• Keep dalda/ghee usage low. Select mustard oil or canola oil for daily cooking.<br>`;
                dietHtml += `• Limit heavy lamb/beef dishes to special occasions and trim visible fat before cooking.<br>`;
                dietHtml += `• Prefer dry chapatis over oil-brushed rotis.`;
            }
        } 
        else if (inputs.diet_type === "Street Food / Fast Food") {
            dietHtml += `<strong>Current Diet:</strong> Fast Food &amp; Deep-Fried Street Food (samosas, pakoras, burgers, paratha rolls).<br><br>`;
            dietHtml += `⚠️ <strong>Dietary Modifications Required:</strong><br>`;
            dietHtml += `• <strong>Eliminate Fried Snacks:</strong> Avoid deep-fried samosas, pakoras, and french fries. They contain trans fats that block coronary arteries.<br>`;
            dietHtml += `• <strong>Sugar Restriction:</strong> Cut out carbonated sodas, sweet lassi, and chai with heavy condensed milk. Switch to green tea, unsweetened mint margaritas, or fresh barley water (sattu).<br>`;
            dietHtml += `• <strong>Swap Refined Flour:</strong> Avoid naan, khameeri roti, and bun-kababs made of white refined flour (maida). Replace them with dry whole-wheat roti.<br>`;
            dietHtml += `• <strong>Healthy Grill Options:</strong> If eating out, choose chicken tikka, seekh kabab (grilled, not fried), or grilled fish over burgers and pizzas. Use mint mint-chutney instead of mayonnaise.`;
        } 
        else if (inputs.diet_type === "Balanced South Asian") {
            dietHtml += `<strong>Current Diet:</strong> Balanced home-cooked meals (Roti, lentils, seasonal vegetables, chicken).<br><br>`;
            dietHtml += `✅ <strong>Maintain &amp; Enhance:</strong><br>`;
            dietHtml += `• You already have a great foundation. Minimize salt (namak) added to handi to keep Blood Pressure low.<br>`;
            dietHtml += `• <strong>Cardio-Protective Boosters:</strong> Add fresh raw garlic (lehsan) and ginger (adrak) to your meals daily. Raw garlic helps reduce arterial plaque.<br>`;
            dietHtml += `• Use skimmed milk (bhalai-utre-hua doodh) instead of full-fat buffalo milk.`;
        } 
        else if (inputs.diet_type === "Vegetarian / Sabzi Dal") {
            dietHtml += `<strong>Current Diet:</strong> Vegetarian / Sabzi Dal (Lentils, beans, and seasonal vegetables).<br><br>`;
            dietHtml += `✅ <strong>Vegetarian Cardio Plan:</strong><br>`;
            dietHtml += `• Ensure you do not use excess oil/ghee for the 'tarka' (tempering) of daal. Use only a spray of olive oil or canola oil.<br>`;
            dietHtml += `• <strong>Heart Healthy Proteins:</strong> Incorporate chickpeas (safaid chana), red kidney beans (loobia), and lentils (split daal) regularly.<br>`;
            dietHtml += `• Take plenty of fresh salads (cucumber, tomatoes, onions) seasoned with lemon juice instead of oily dressings.`;
        }

        dietPlanEl.innerHTML = dietHtml;
    }

    // ─── 7. Analytics & Charts rendering ───────────────────────────────────
    function renderAnalyticsCharts() {
        const placeholder = document.getElementById('analytics-placeholder');
        const dashboard = document.getElementById('analytics-dashboard');

        if (!currentPrediction) {
            placeholder.classList.remove('hidden');
            dashboard.classList.add('hidden');
            return;
        }

        placeholder.classList.add('hidden');
        dashboard.classList.remove('hidden');

        // Extract parameters
        const inputs = currentPrediction.inputs;
        const output = currentPrediction.output;

        // Dynamic subtitle for comparison card
        const subtitleEl = document.getElementById('comparison-cohort-subtitle');
        if (subtitleEl) {
            subtitleEl.textContent = `Comparing ${inputs.patient_name}'s clinical parameters vs. a healthy normal person of age ${inputs.age}`;
        }

        // ─── E. New Chart: Healthy Peer Comparison (Same Age) ─────────────────
        const ctxNormal = document.getElementById('chart-normal-compare').getContext('2d');
        if (chartNormalCompare) chartNormalCompare.destroy();

        // Calculate healthy reference values for same age
        const healthyBP = 115; // Ideal BP is 115 mmHg
        const healthyChol = 180; // Ideal cholesterol is under 200, typically 180 mg/dl
        const healthyMaxHR = 220 - inputs.age; // Age formula for heart rate

        chartNormalCompare = new Chart(ctxNormal, {
            type: 'bar',
            data: {
                labels: ['Resting BP (mmHg)', 'Cholesterol (mg/dl)', 'Max Heart Rate (bpm)'],
                datasets: [
                    {
                        label: `${inputs.patient_name}'s Levels`,
                        data: [inputs.trestbps, inputs.chol, inputs.thalach],
                        backgroundColor: '#a855f7',
                        borderColor: '#a855f7',
                        borderRadius: 5,
                        borderWidth: 1
                    },
                    {
                        label: `Healthy Peer Ideal (Age ${inputs.age})`,
                        data: [healthyBP, healthyChol, healthyMaxHR],
                        backgroundColor: '#14b8a6',
                        borderColor: '#14b8a6',
                        borderRadius: 5,
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#8b95a8', font: { family: 'Plus Jakarta Sans', weight: '600' } }
                    }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#8b95a8', font: { family: 'Plus Jakarta Sans' } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#ffffff', font: { family: 'Outfit', weight: '600' } }
                    }
                }
            }
        });

        // ─── A. Chart: Feature Importance (XAI) ────────────────────────────────
        const ctxXAI = document.getElementById('chart-feature-importance').getContext('2d');
        if (chartXAI) chartXAI.destroy();

        const xaiData = output.feature_importances || {};
        const labelsXAI = Object.keys(xaiData).map(k => k.toUpperCase());
        const valuesXAI = Object.values(xaiData);

        const combinedXAI = labelsXAI.map((l, i) => ({ label: l, val: valuesXAI[i] }))
                                     .sort((a, b) => b.val - a.val);

        chartXAI = new Chart(ctxXAI, {
            type: 'bar',
            data: {
                labels: combinedXAI.map(x => x.label),
                datasets: [{
                    label: 'Contribution Weight',
                    data: combinedXAI.map(x => x.val),
                    backgroundColor: combinedXAI.map((x, i) => i < 3 ? '#ec4899' : '#6366f1'),
                    borderRadius: 5,
                    borderWidth: 0
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#8b95a8', font: { family: 'Plus Jakarta Sans' } }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#ffffff', font: { family: 'Outfit', weight: '600' } }
                    }
                }
            }
        });

        // ─── B. Chart: Risk Factor Radar (Normalized patient inputs) ───────────
        const ctxRadar = document.getElementById('chart-radar').getContext('2d');
        if (chartRadar) chartRadar.destroy();

        // Normalization formulas to fit inputs on a scale of 0 to 100
        const normAge = ((inputs.age - 29) / (80 - 29)) * 100;
        const normBP = ((inputs.trestbps - 90) / (200 - 90)) * 100;
        const normChol = ((inputs.chol - 120) / (570 - 120)) * 100;
        const normHR = ((210 - inputs.thalach) / (210 - 70)) * 100;
        const normAngina = inputs.exang * 100;
        const normCP = (inputs.cp === 0 ? 80 : inputs.cp === 3 ? 100 : inputs.cp === 1 ? 40 : 20);

        chartRadar = new Chart(ctxRadar, {
            type: 'radar',
            data: {
                labels: ['Age', 'Blood Pressure', 'Cholesterol', 'Low Heart Rate', 'Exercise Angina', 'Chest Pain Severity'],
                datasets: [
                    {
                        label: 'Patient Metrics',
                        data: [normAge, normBP, normChol, normHR, normAngina, normCP],
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        borderColor: '#6366f1',
                        borderWidth: 2,
                        pointBackgroundColor: '#6366f1'
                    },
                    {
                        label: 'Low Risk Threshold',
                        data: [40, 45, 30, 30, 0, 20],
                        backgroundColor: 'rgba(20, 184, 166, 0.08)',
                        borderColor: '#14b8a6',
                        borderWidth: 1.5,
                        borderDash: [5, 5],
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#8b95a8', font: { family: 'Plus Jakarta Sans', size: 10 } }
                    }
                },
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
                        grid: { color: 'rgba(255, 255, 255, 0.08)' },
                        pointLabels: { color: '#8b95a8', font: { family: 'Plus Jakarta Sans', size: 10 } },
                        ticks: { display: false },
                        min: 0,
                        max: 100
                    }
                }
            }
        });

        // ─── C. Chart: Model Comparison ──────────────────────────────────────
        const ctxCompare = document.getElementById('chart-model-compare').getContext('2d');
        if (chartModelCompare) chartModelCompare.destroy();

        const modelAccs = output.all_accuracies || {};
        const labelsCompare = Object.keys(modelAccs);
        const valuesCompare = Object.values(modelAccs);

        chartModelCompare = new Chart(ctxCompare, {
            type: 'bar',
            data: {
                labels: labelsCompare,
                datasets: [{
                    label: 'Accuracy (%)',
                    data: valuesCompare,
                    backgroundColor: labelsCompare.map(n => n === output.model_name ? '#10b981' : 'rgba(255, 255, 255, 0.15)'),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        min: 70,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#8b95a8' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#ffffff', font: { family: 'Outfit', weight: '600' } }
                    }
                }
            }
        });

        // ─── D. Chart: Risk Probability History Trend ────────────────────────
        loadHistory().then(() => {
            const ctxTrend = document.getElementById('chart-history-trend').getContext('2d');
            if (chartHistoryTrend) chartHistoryTrend.destroy();

            const chronological = [...historyData].reverse();

            chartHistoryTrend = new Chart(ctxTrend, {
                type: 'line',
                data: {
                    labels: chronological.map(h => h.timestamp.split(' ')[1] || h.timestamp),
                    datasets: [{
                        label: 'Predicted Risk Probability (%)',
                        data: chronological.map(h => h.probability),
                        borderColor: '#a855f7',
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        fill: true,
                        tension: 0.35,
                        pointBackgroundColor: '#ec4899',
                        pointBorderColor: '#fff',
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#8b95a8' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#8b95a8' }
                        }
                    }
                }
            });
        });
    }

    // ─── 8. Find Doctors Tab Logic ─────────────────────────────────────────
    let doctorsList = [];
    const searchInput = document.getElementById('doctor-search');
    const filterSelect = document.getElementById('doctor-filter');

    async function loadDoctors() {
        try {
            const res = await fetch('/doctors');
            if (!res.ok) throw new Error("Failed to fetch doctors");
            doctorsList = await res.json();
            renderDoctors(doctorsList);
        } catch (err) {
            console.error(err);
            const grid = document.getElementById('doctors-grid');
            if (grid) grid.innerHTML = `<div class="doctors-loading">Failed to load doctor directory.</div>`;
        }
    }

    function renderDoctors(list) {
        const grid = document.getElementById('doctors-grid');
        if (!grid) return;

        if (list.length === 0) {
            grid.innerHTML = `<div class="doctors-loading">No doctors found matching search criteria.</div>`;
            return;
        }

        grid.innerHTML = list.map(doc => {
            const initials = doc.name.split(' ').slice(1).map(n => n[0]).join('').substring(0, 2);
            const availabilityClass = doc.available ? 'available' : 'busy';
            const availabilityText = doc.available ? 'Available Now' : 'Consulting';

            return `
                <div class="doctor-card">
                    <div class="doctor-header">
                        <div class="doctor-avatar">${initials}</div>
                        <div class="doctor-info">
                            <h4 class="doctor-name">${doc.name}</h4>
                            <div class="doctor-specialty">${doc.specialty}</div>
                            <div class="doctor-clinic">${doc.clinic}</div>
                        </div>
                        <div class="doctor-availability ${availabilityClass}">
                            <span class="avail-dot"></span>
                            <span>${availabilityText}</span>
                        </div>
                    </div>
                    <div class="doctor-meta">
                        <span><i class="fa-solid fa-map-pin"></i> ${doc.address}</span>
                        <span><i class="fa-solid fa-phone"></i> ${doc.phone}</span>
                    </div>
                    <div class="doctor-rating">
                        <span class="stars">${'★'.repeat(Math.round(doc.rating))}</span>
                        <span class="rating-val">${doc.rating}</span>
                        <span class="rating-reviews">(${doc.reviews} patient reviews)</span>
                    </div>
                    <div class="doctor-actions">
                        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(doc.clinic + " " + doc.address)}" target="_blank" class="btn-map">
                            <i class="fa-solid fa-location-arrow"></i> View on Map
                        </a>
                        <a href="tel:${doc.phone}" class="btn-call">
                            <i class="fa-solid fa-phone-flip"></i> Call Clinic
                        </a>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Searching & filtering doctors
    if (searchInput) {
        searchInput.addEventListener('input', applyDoctorFilters);
    }
    if (filterSelect) {
        filterSelect.addEventListener('change', applyDoctorFilters);
    }

    function applyDoctorFilters() {
        const query = searchInput.value.toLowerCase().trim();
        const availability = filterSelect.value;

        const filtered = doctorsList.filter(doc => {
            const matchesQuery = doc.name.toLowerCase().includes(query) ||
                                 doc.specialty.toLowerCase().includes(query) ||
                                 doc.clinic.toLowerCase().includes(query) ||
                                 doc.address.toLowerCase().includes(query);
            const matchesAvailability = availability === 'all' || (availability === 'available' && doc.available);
            return matchesQuery && matchesAvailability;
        });

        renderDoctors(filtered);
    }

    // ─── 9. History Tab Logic ──────────────────────────────────────────────
    const refreshHistoryBtn = document.getElementById('refresh-history-btn');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const historyEmpty = document.getElementById('history-empty');
    const historyTableWrap = document.getElementById('history-table-wrap');
    const historyTbody = document.getElementById('history-tbody');
    const statsRow = document.getElementById('history-stats-row');

    async function loadHistory() {
        try {
            const res = await fetch('/history');
            if (!res.ok) throw new Error("History fetch failed");
            historyData = await res.json();
            renderHistoryTable();
            renderHistoryStats();
        } catch (err) {
            console.error(err);
        }
    }

    function renderHistoryTable() {
        if (!historyTbody) return;

        if (historyData.length === 0) {
            historyEmpty.classList.remove('hidden');
            historyTableWrap.classList.add('hidden');
            return;
        }

        historyEmpty.classList.add('hidden');
        historyTableWrap.classList.remove('hidden');

        historyTbody.innerHTML = historyData.map((row, index) => {
            const isHigh = row.risk_label.toLowerCase().includes('high');
            const pillClass = isHigh ? 'high' : 'low';
            return `
                <tr>
                    <td><strong>${historyData.length - index}</strong></td>
                    <td><strong>${row.patient_name}</strong></td>
                    <td>${row.timestamp}</td>
                    <td>${row.age}</td>
                    <td><span style="font-size:0.78rem;color:var(--text-muted);">${row.diet_type}</span></td>
                    <td>${row.trestbps}</td>
                    <td>${row.chol}</td>
                    <td>${row.thalach}</td>
                    <td>
                        <span class="risk-pill ${pillClass}">
                            <i class="fa-solid ${isHigh ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i>
                            ${row.risk_label}
                        </span>
                    </td>
                    <td><strong>${row.probability}%</strong></td>
                    <td><code>${row.model_used}</code></td>
                </tr>
            `;
        }).join('');
    }

    function renderHistoryStats() {
        if (!statsRow) return;

        if (historyData.length === 0) {
            statsRow.innerHTML = '';
            return;
        }

        const total = historyData.length;
        const avgProb = (historyData.reduce((sum, row) => sum + row.probability, 0) / total).toFixed(1);
        const highRiskCount = historyData.filter(row => row.risk_label.toLowerCase().includes('high')).length;
        const highRiskRatio = ((highRiskCount / total) * 100).toFixed(0);

        statsRow.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon indigo"><i class="fa-solid fa-chart-line-up"></i></div>
                <div>
                    <div class="stat-label">Total Tests</div>
                    <div class="stat-value">${total}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon purple"><i class="fa-solid fa-shield-heart"></i></div>
                <div>
                    <div class="stat-label">Average Risk</div>
                    <div class="stat-value">${avgProb}%</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon red"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div>
                    <div class="stat-label">High Risk Incidents</div>
                    <div class="stat-value">${highRiskCount} <span style="font-size:0.8rem;color:var(--text-muted);">(${highRiskRatio}%)</span></div>
                </div>
            </div>
        `;
    }

    async function updateHistoryCount() {
        try {
            const res = await fetch('/history');
            if (res.ok) {
                const data = await res.json();
                const countBadge = document.getElementById('history-count');
                if (countBadge) {
                    if (data.length > 0) {
                        countBadge.textContent = data.length;
                        countBadge.style.display = 'inline-block';
                    } else {
                        countBadge.style.display = 'none';
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }
    // Update count badge initially
    updateHistoryCount();

    if (refreshHistoryBtn) {
        refreshHistoryBtn.addEventListener('click', loadHistory);
    }

    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', async () => {
            if (!confirm("Are you sure you want to clear all patient prediction records? This action cannot be undone.")) return;

            try {
                const res = await fetch('/history/clear', { method: 'POST' });
                if (res.ok) {
                    loadHistory();
                    updateHistoryCount();
                    // Reset current prediction so analytics knows there's no data
                    currentPrediction = null;
                }
            } catch (err) {
                alert("Failed to clear history records.");
            }
        });
    }
});
