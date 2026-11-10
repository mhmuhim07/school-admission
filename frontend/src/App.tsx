import { useEffect, useState } from "react";
import { API_URL } from "./config";

export default function App() {
  const [message, setMessage] = useState("Checking connection to the server...");

  useEffect(() => {
    fetch(`${API_URL}/classes`)
      .then((res) => res.json())
      .then((data: unknown[]) => setMessage(`Connected to the server. Classes found: ${data.length}`))
      .catch(() => setMessage("Cannot reach the server. Please check that it is running and try again."));
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>School Admission</h1>
      <p>{message}</p>
      <small>API: {API_URL}</small>
    </main>
  );
}