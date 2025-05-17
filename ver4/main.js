// In main.js or equivalent:
function getTimelineDataForSave() {
return {
... other data ...
scheduledTimelineTasks: getScheduledTasksData(), // from timelines.js
};
}

function loadTimelineFromFile(file) {
...
if (data.scheduledTimelineTasks) {
setScheduledTasksDataAndRender(data.scheduledTimelineTasks); // from timelines.js
}
...
}