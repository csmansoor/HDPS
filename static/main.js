document.addEventListener('DOMContentLoaded', () => {
    // 1. Sliders - Live value updating
    const sliders = [
        { id: 'age', valId: 'age-val' },
        { id: 'trestbps', valId: 'trestbps-val' },
        { id: 'chol', valId: 'chol-val' },
        { id: 'thalach', valId: 'thalach-val' }
    ];

    sliders.forEach(sliderInfo => {
        const sliderEl = document.getElementById(sliderInfo.id);
        const valEl = document.getElementById(sliderInfo.valId);
        
        if (sliderEl && valEl) {
            sliderEl.addEventListener('input', (e) => {
                valEl.textContent = e.target.value;
            });
        }
    });

    // 2. Toggle Buttons (Sex, FBS, Exercise Angina)
    setupToggleGroup('sex-group', 'sex');
    setupToggleGroup('fbs-group', 'fbs');
    setupToggleGroup('exang-group', 'exang');

    function setupToggleGroup(groupId, hiddenInputId) {
        const group = document.getElementById(groupId);
        const hiddenInput = document.getElementById(hiddenInputId);
        if (!group || !hiddenInput) return;

        const buttons = group.querySelectorAll('.btn-toggle');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                hiddenInput.value = btn.dataset.val;
            });
        });
    }

    // 3. Card Selector Grid (Chest Pain Type)
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

    // 4. Form Submission and Inference
    const form = document.getElementById('prediction-form');
    const predictBtn = document.getElementById('predict-btn');
    const placeholderContainer = document.getElementById('placeholder-container');
    const resultsContainer = document.getElementById('results-container');
    
    // Result elements
    const riskBadge = document.getElementById('risk-badge');
    const riskLabelText = document.getElementById('risk-label-text');
    const gaugePct = document.getElementById('gauge-pct');
    const gaugeFill = document.getElementById('gauge-fill');
    const riskAnalysisText = document.getElementById('risk-analysis-text');
    
    // Metric summary elements
    const metricBp = document.getElementById('metric-bp');
    const metricChol = document.getElementById('metric-chol');
    const metricHr = document.getElementById('metric-hr');
    const metricAngina = document.getElementById('metric-angina');
    
    // Recommendations list
    const recsList = document.getElementById('recs-list');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Set loading state
            predictBtn.disabled = true;
            const originalBtnHtml = predictBtn.innerHTML;
            predictBtn.innerHTML = `<span>Analyzing Cardiac Profile...</span> <i class="fa-solid fa-spinner fa-spin"></i>`;
            
            // Gather input values
            const payload = {
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
                const response = await fetch('/predict', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error('Prediction API failed.');
                }

                const result = await response.json();
                
                // Show results panel and hide placeholder
                placeholderContainer.classList.add('hidden');
                resultsContainer.classList.remove('hidden');
                
                // Update Risk Badge Style and Text
                riskLabelText.textContent = result.label.toUpperCase();
                riskBadge.style.color = result.color;
                riskBadge.style.borderColor = result.color;
                riskBadge.style.backgroundColor = result.background;
                
                // Animate Gauge & Percentage Counter
                const probability = result.probability;
                animateGauge(probability, result.color);
                
                // Set Key Metrics Summary text
                metricBp.textContent = `${payload.trestbps} mmHg`;
                metricChol.textContent = `${payload.chol} mg/dl`;
                metricHr.textContent = `${payload.thalach} bpm`;
                metricAngina.textContent = payload.exang === 1 ? 'Yes' : 'No';

                // Generate Custom Insights & Recommendations
                generateClinicalInsights(payload, probability, result.label, riskAnalysisText, recsList);

            } catch (err) {
                console.error(err);
                alert("An error occurred during risk assessment. Please check if the backend server is running and try again.");
            } finally {
                // Restore button state
                predictBtn.disabled = false;
                predictBtn.innerHTML = originalBtnHtml;
            }
        });
    }

    // Function to animate gauge progress
    function animateGauge(targetPercent, color) {
        const circumference = 314; // 2 * PI * r (r=50)
        
        // Clear classes and styles
        gaugeFill.style.stroke = color;
        
        // Counter animation
        let currentPercent = 0;
        const duration = 1000; // 1s
        const steps = 60;
        const stepTime = duration / steps;
        const increment = targetPercent / steps;
        
        const timer = setInterval(() => {
            currentPercent += increment;
            if (currentPercent >= targetPercent) {
                currentPercent = targetPercent;
                clearInterval(timer);
            }
            
            // Update percentage text
            gaugePct.textContent = `${currentPercent.toFixed(1)}%`;
            
            // Update circular path dashoffset
            const offset = circumference - (currentPercent / 100) * circumference;
            gaugeFill.style.strokeDashoffset = offset;
        }, stepTime);
    }

    // Function to generate dynamic clinical insights and suggestions based on metrics
    function generateClinicalInsights(inputs, prob, label, textEl, listEl) {
        let insights = "";
        let recs = [];

        // 1. Generate text insights based on risk and parameters
        if (label === "High Risk") {
            insights = `The machine learning model classifies this profile as **High Risk** (${prob}% probability of cardiovascular risk). This is driven primarily by a combination of key markers: `;
            
            let drivers = [];
            if (inputs.exang === 1) drivers.push("exercise-induced angina (chest discomfort during physical activity)");
            if (inputs.cp === 0) drivers.push("typical anginal chest pain symptoms");
            if (inputs.trestbps > 140) drivers.push(`elevated resting blood pressure of ${inputs.trestbps} mmHg`);
            if (inputs.chol > 240) drivers.push(`elevated serum cholesterol of ${inputs.chol} mg/dl`);
            if (inputs.thalach < 120) drivers.push(`reduced maximum heart rate capacity (${inputs.thalach} bpm) during physical exercise`);
            
            if (drivers.length > 0) {
                insights += drivers.join(", ") + ". ";
            } else {
                insights += "age and overall clinical feature composition.";
            }
            insights += " Immediate consultation with a cardiologist is recommended for diagnostic confirmation and testing.";
        } else {
            insights = `The machine learning model classifies this profile as **Low Risk** (${prob}% probability). This suggests that the current combination of cardiovascular markers is within a healthy or low-risk threshold. `;
            
            if (inputs.trestbps > 130 || inputs.chol > 200) {
                insights += "However, minor preventative actions are recommended to address slightly elevated baseline values.";
            } else {
                insights += "Continue maintaining your healthy lifestyle to sustain these markers.";
            }
        }
        
        textEl.innerHTML = insights;

        // 2. Generate customized intervention checklists
        if (inputs.trestbps > 130) {
            recs.push("<strong>Blood Pressure Management:</strong> Maintain a low-sodium diet (under 2,000 mg daily) and monitor resting blood pressure regularly.");
        }
        if (inputs.chol > 200) {
            recs.push("<strong>Lipid Profiling:</strong> Limit saturated fats and dietary cholesterol. Incorporate soluble fibers, omega-3 fatty acids, or discuss statin therapy if recommended by a physician.");
        }
        if (inputs.thalach < 130 && label === "High Risk") {
            recs.push("<strong>Cardiovascular Training:</strong> Engage in light-to-moderate aerobic exercise (e.g., brisk walking) only after clearance from a cardiologist.");
        } else {
            recs.push("<strong>Active Lifestyle:</strong> Aim for at least 150 minutes of moderate-intensity aerobic exercise per week.");
        }
        if (inputs.sex === 1 && inputs.age > 45) {
            recs.push("<strong>Routine Screening:</strong> For men over 45, regular cardiovascular checkups and ECG screens are highly advised.");
        }
        if (label === "High Risk") {
            recs.push("<strong>Consult Cardiologist:</strong> Schedule an appointment with a specialist for further diagnostic tests such as a 12-lead ECG, stress test, or echocardiogram.");
        } else {
            recs.push("<strong>Prevention Plan:</strong> Maintain a heart-healthy diet high in vegetables, whole grains, and lean proteins.");
        }

        // Render recommendations
        listEl.innerHTML = recs.map(rec => `<li>${rec}</li>`).join('');
    }
});
