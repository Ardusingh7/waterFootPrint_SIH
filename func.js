let model;
let waterFootprintData = {};
let isAgricultural = false;

// Load COCO-SSD model when the page loads
async function loadModel() {
    model = await cocoSsd.load();
    console.log("Model loaded successfully");
}

// Load the water footprint data from the appropriate CSV file
async function loadCSVData(csvFile) {
    const response = await fetch(csvFile);
    const csvData = await response.text();  

    Papa.parse(csvData, {
        header: true,
        dynamicTyping: true,
        complete: function(results) {
            waterFootprintData = {}; // Clear existing data
            results.data.forEach(row => {
                waterFootprintData[row.products] = row.water_footprint;
            });
        }
    });
}

// Show the agriculture question
function askAgricultureQuestion() {
    document.getElementById('agriculture-question').style.display = 'block';
}

// Handle the response to the agriculture question
function handleAgricultureResponse(isAgriculturalResponse) {
    document.getElementById('agriculture-question').style.display = 'none';

    isAgricultural = isAgriculturalResponse;
    // Load the appropriate CSV file based on the agriculture response
    const csvFile = isAgricultural ? 'wafoot.csv' : 'wafoot2.csv';
    loadCSVData(csvFile);

    // Proceed with object analysis after loading the CSV data
    const canvas = document.getElementById('canvas');
    const img = new Image();
    img.src = canvas.toDataURL();
    detectObjects(img);
}

// Load and display the uploaded image
function loadImage(event) {
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');
    const reader = new FileReader();

    reader.onload = function () {
        const img = new Image();
        img.onload = function () {
            canvas.width = img.width;
            canvas.height = img.height;
            context.drawImage(img, 0, 0, img.width, img.height);

            // Show agriculture question before analyzing
            askAgricultureQuestion();
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(event.target.files[0]);
}

// Detect objects in the image
async function detectObjects(img) {
    const predictions = await model.detect(img);
    const context = document.getElementById('canvas').getContext('2d');
    let shouldPromptForNewImage = false;
    let classifiedModel = '';

    predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;

        // Draw bounding box
        context.beginPath();
        context.rect(x - 2, y - 2, width + 4, height + 4);
        context.lineWidth = 3;
        context.strokeStyle = 'red';
        context.stroke();

        // Draw label
        context.font = '20px Arial';
        context.fillStyle = 'red';
        const text = `${prediction.class} ${Math.round(prediction.score * 100)}%`;
        context.fillText(text, x, y > 20 ? y - 10 : y + 20);

        // Determine the model with the highest score
        if (prediction.score * 100 > (classifiedModel ? classifiedModel.score : 0)) {
            classifiedModel = {
                label: prediction.class,
                score: prediction.score * 100
            };
        }

        // Check if any prediction has accuracy below 85%
        if (prediction.score * 100 < 85) {
            shouldPromptForNewImage = true;
        }
    });

    // If accuracy is below 85%, prompt user to upload another image and stop further processing
    if (shouldPromptForNewImage) {
        setTimeout(() => {
            alert('The accuracy of the object detection is below 85%. Please upload another image for better results.');
            rejectImage(); // Clear the current image and prompt user to upload a new one
        }, 500); // Slight delay to ensure detection information is displayed before alert
        return; // Stop further processing
    }

    // Hide detection info and show the question
    document.getElementById('detection-info').style.display = 'none';
    showConfirmationQuestion(classifiedModel.label);
}

// Show the confirmation question with options
function showConfirmationQuestion(label) {
    const questionText = `Is this the image of a ${label}? Shall we continue?`;
    document.getElementById('question-text').textContent = questionText;
    document.getElementById('confirmation-question').style.display = 'block';
}

// Handle the user's response to the question
function handleUserResponse(isConfirmed) {
    document.getElementById('confirmation-question').style.display = 'none';

    if (isConfirmed) {
        document.getElementById('confirm-section').style.display = 'flex';
    } else {
        rejectImage(); // Clear the current image and prompt user to upload a new one
    }
}

// Confirm 'Yes' action to enter image name for water footprint retrieval
function yesConfirm() {
    document.getElementById('confirm-section').style.display = 'none';
    document.getElementById('name-input-section').style.display = 'block';
}

// Retrieve water footprint data based on image name entered by the user
function retrieveWaterFootprint() {
    const objectName = document.getElementById('image-name').value.trim();

    if (objectName) {
        if (waterFootprintData[objectName]) {
            document.getElementById('water-data').textContent = `Water Footprint: ${waterFootprintData[objectName]} liters`;
            document.getElementById('error-message').textContent = '';
        } else {
            document.getElementById('water-data').textContent = '';
            document.getElementById('error-message').textContent = `No water footprint data found for "${objectName}".`;
        }

        document.getElementById('water-section').style.display = 'block';
    } else {
        alert('Please enter an image name.');
    }
}

// Show options when "No" is selected
function showNoOptions() {
    document.getElementById('confirm-section').style.display = 'none';
    document.getElementById('no-options').style.display = 'flex';
}

// Function to reject and upload a new image
function rejectImage() {
    document.getElementById('no-options').style.display = 'none';
    document.getElementById('canvas').getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('detection-info').style.display = 'none'; // Hide detection info
    document.getElementById('name-input-section').style.display = 'none'; // Hide name input section if it was visible
    document.getElementById('confirmation-question').style.display = 'none'; // Hide confirmation question section
}

// Initialize the model
loadModel();
