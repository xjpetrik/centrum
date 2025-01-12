import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Login";
import Dashboard from "./Dashboard";


let darkMode = localStorage.getItem("darkMode");
darkMode = (darkMode === "dark") ? "dark" : "nodark";
document.body.setAttribute("data-bs-theme", darkMode);

const App: React.FC = () => {
  const isLoggedIn = !!localStorage.getItem("sessionToken");

  return (
    <BrowserRouter basename="/centrum">
      <Routes>
        <Route
          path="/"
          element={isLoggedIn ? <Navigate to="/dashboard" /> : <Login />}
        />
        <Route
          path="/dashboard"
          element={isLoggedIn ? <Dashboard /> : <Navigate to="/" />}
        />
      </Routes>
    </BrowserRouter>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
