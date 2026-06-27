// Configuration for connecting to the local backend.
// In development, when running on physical Android device connected to the same Wi-Fi,
// replace BACKEND_IP with your development machine's local IP address (e.g. 192.168.x.x).
export const BACKEND_IP = '192.168.0.100'; 
export const BACKEND_PORT = '3000';
export const BACKEND_URL = `http://${BACKEND_IP}:${BACKEND_PORT}`;
