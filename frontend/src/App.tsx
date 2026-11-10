import { useState } from "react";
import { StudentProvider } from "./context/StudentContext";
import { StudentIdentityBar } from "./components/StudentIdentityBar";
import { ClassList } from "./components/ClassList";
import { MyApplications } from "./components/MyApplications";

export default function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSync = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <StudentProvider>
      <div className="app-shell">
        <StudentIdentityBar />
        <main className="container-main">
          <MyApplications
            refreshTrigger={refreshTrigger}
            onHoldStatusChange={handleSync}
          />
          <ClassList
            refreshTrigger={refreshTrigger}
            onApplySuccess={handleSync}
          />
        </main>
      </div>
    </StudentProvider>
  );
}
