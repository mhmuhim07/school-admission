import { useState } from "react";
import { StudentProvider } from "./context/StudentContext";
import { StudentIdentityBar } from "./components/StudentIdentityBar";
import { ClassList } from "./components/ClassList";
import { MyApplications } from "./components/MyApplications";
import { AdminPanel } from "./components/AdminPanel";

export default function App() {
  const [activeTab, setActiveTab] = useState<"student" | "admin">("student");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSync = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <StudentProvider>
      <div className="app-shell">
        <StudentIdentityBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <main className="container-main">
          {activeTab === "student" ? (
            <>
              <MyApplications
                refreshTrigger={refreshTrigger}
                onHoldStatusChange={handleSync}
              />
              <ClassList
                refreshTrigger={refreshTrigger}
                onApplySuccess={handleSync}
              />
            </>
          ) : (
            <AdminPanel
              refreshTrigger={refreshTrigger}
              onClassCreated={handleSync}
            />
          )}
        </main>
      </div>
    </StudentProvider>
  );
}
