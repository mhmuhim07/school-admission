import { StudentProvider } from "./context/StudentContext";
import { StudentIdentityBar } from "./components/StudentIdentityBar";

export default function App() {
  return (
    <StudentProvider>
      <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <StudentIdentityBar />
        <main style={{ maxWidth: "1100px", margin: "24px auto", padding: "0 24px" }}>
        </main>
      </div>
    </StudentProvider>
  );
}
