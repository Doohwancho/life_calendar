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
    },

        /**
     * Unsubscribe from an event.
     * @param {string} eventName - The name of the event.
     * @param {function} callbackToRemove - The specific function to remove.
     */
    off(eventName, callbackToRemove) {
        if (!eventListeners[eventName]) {
            return;
        }
        // 제공된 콜백 함수와 일치하지 않는 리스너들만 남기고 배열을 새로 만듦
        eventListeners[eventName] = eventListeners[eventName].filter(
            callback => callback !== callbackToRemove
        );
    }
};