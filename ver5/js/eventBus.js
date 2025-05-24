const eventListeners = {};

export const eventBus = {
    /**
     * Subscribe to an event.
     * @param {string} eventName - The name of the event.
     * @param {function} callback - The function to call when the event is dispatched.
     */
    on(eventName, callback) {
        if (!eventListeners[eventName]) {
            eventListeners[eventName] = [];
        }
        eventListeners[eventName].push(callback);
    },

    /**
     * Dispatch an event.
     * @param {string} eventName - The name of the event.
     * @param {*} data - The data to pass to the listeners.
     */
    dispatch(eventName, data) {
        if (eventListeners[eventName]) {
            eventListeners[eventName].forEach(callback => callback(data));
        }
    }
};