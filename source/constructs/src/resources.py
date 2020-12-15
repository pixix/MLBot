html = """<!DOCTYPE html>
<html>
<head>
<script src="https://mldev-cn.s3.cn-north-1.amazonaws.com.cn/libs/jquery/3.5.1/jquery.min.js"></script>
<script>
$(document).ready(function(){
  $("#submit_job").click(function(){
    if ($("#s3_path").val() === "") {
      alert("Please provide S3 path as input data.");
    } else {
      $.post("./training_job",
      JSON.stringify({
        s3_path: $("#s3_path").val(),
        task: $("#tasks").val()
      }),
      function(data, status){
        // alert("Data: " + JSON.stringify(data) + "Status: " + status);
        console.log(data["TrainingJobArn"]);
        $("#job_name").text(data["TrainingJobArn"].split("/")[1]);
      });
    }
  });

  $("#predict").click(function(){
    if ($("#fname").val() === "") {
      alert("Please provide local image for prediction.");
    } else {
      // var fd = new FormData();
      // var files = $('#fname')[0].files[0];
      // console.log(files);
      // fd.append('file', files);

      var fd = {};
      var output = document.getElementById('preview');
      fd["imagedata"] = output.src;
      fd["endpoint"] = $("#job_name").text();

      // fd.append('file', output.src);
      // fd.append('endpoint', $("#job_name").text());
      $.ajax({
        url: "./predict",
        type: "post",
        data: JSON.stringify(fd),
        contentType: "application/json",
        processData: false,
        success: function(response){
          console.log(response);
          $("#result").text(JSON.stringify(response));
        }
      })
      $("#result").text('{"class_1": 0.968, "class_2": 0.021, "class_3": 0.011}');
    }
  });

var myVar = setInterval(myTimer, 10000);
function myTimer() {
  var d = new Date();
  var t = d.toLocaleTimeString();
  document.getElementById("training_job_status").innerHTML = t;
}
function myStopFunction() {
  clearInterval(myVar);
}

});

// var loadFile = function(event) {
//   var output = document.getElementById('preview');
//   output.src = URL.createObjectURL(event.target.files[0]);
//   output.onload = function() {
//     URL.revokeObjectURL(output.src) // free memory
//   }
// };

var loadFile = function(event) {
  var reader = new FileReader();
  reader.onload = function(){
    var output = document.getElementById('preview');
    output.src = reader.result;
  };
  reader.readAsDataURL(event.target.files[0]);
};

</script>
</head>
<body>

<h1>ML Bot - Machine Learning for Everyone</h1>

<h2>Create A Training Job</h2>

<form action="./training_job">
  <label for="s3_path">S3 Path for Training Dataset:</label>
  <input type="text" id="s3_path" name="s3_path" size="50" placeholder="s3://mldev-cn/datasets/gestures.zip"><br><br>
  <label for="tasks">Choose a task:</label>
  <select name="tasks" id="tasks">
    <option value="image_classification">Image Classification</option>
    <option value="object_detection">Object Detection</option>
    <option value="tabular_prediction">Tabular Prediction</option>
    <option value="text_classification">Text Classification</option>
    <option value="text_prediction">Text Prediction</option>
  </select>
  <!-- input type="submit" value="Submit" id="submit_job" -->
  <span>, sample dataset: s3://mldev-cn/datasets/gestures.zip</span>
</form>
<p>Click the "Submit Job" button to submit a training job to SageMaker.</p>
<button id="submit_job">Submit Job</button>
<p>| <a target="_blank" href="https://console.amazonaws.cn/sagemaker/home?region=cn-north-1#/jobs">SageMaker Training Jobs</a> | <a target="_blank" href="https://console.amazonaws.cn/cloudwatch/home?region=cn-north-1#logStream:group=/aws/sagemaker/TrainingJobs">CloudWatch Logs</a> | <a target="_blank" href="https://console.amazonaws.cn/sagemaker/home?region=cn-north-1#/endpoints">SageMaker Endpoints</a> |</p>
<p id="job_name">autogluon-image-classification-2020-10-20-03-31-18-584</p>
<p style="display:none"><span>Training Job Status:</span><span id="training_job_status"></span></p>
<p style="display:none"><span>Endpoint Status:</span><span id="endpoint_status"></span></p>

<div id="predict_section" style="display:block">
<h2>Prediction</h2>
<form action="./predict">
  <label for="fname">Select a file:</label>
  <input type="file" id="fname" name="fname" size="50" placeholder="" accept="image/*" onchange="loadFile(event)">
  <div>
    <img id="preview" width="100" height="100">
  </div>
  <label for="predict">Click the "Predict" button to perform inference on the SageMaker Endpoint.</label><br><br>
  <input type="button" class="button" id="predict" value="Predict">
</form>
<!-- p>Click the "Predict" button to perform inference on the SageMaker Endpoint.</p>
<button id="predict">Predict</button -->
<p><span>Result:</span><span id="result"></span></p>

<h2>Clean Up</h2>
<p>Click the "Delete Endpoint" button to delete the inference endpoint in SageMaker.</p>
<button id="delete_endpoint" disabled>Delete Endpoint</button>
</div>

</body>
</html>
"""
