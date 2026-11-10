import { StudentProvider } from "./context/StudentContext";
import { StudentIdentityBar } from "./components/StudentIdentityBar";
import { ClassList } from "./components/ClassList";

export default function App() {
  return (
    <StudentProvider>
      <div className="app-shell">
        <StudentIdentityBar />
        <main className="container-main">
          <ClassList />
        </main>
      </div>
    </StudentProvider>
  );
}
