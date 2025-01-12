import React, { useState } from "react";
import CryptoJS from "crypto-js";
import "bootstrap/dist/css/bootstrap.min.css";

const Login: React.FC = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            setError("Please fill in all fields");
            return;
        }
        const hashedPassword = CryptoJS.SHA256(password).toString();
        try {
            const response = await fetch("https://data-server-892925846021.europe-central2.run.app/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, hashedPassword }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("sessionToken", data.token);
                window.location.href = "/centrum/"; 
            } else {
                setError(data.error || "Login failed");
            }
        } catch (err) {
            console.log(err);
            setError("Something went wrong, please try again later");
        }
    };

    const dismissAlert = () => {
        setError("");
    };

    return (
        <div className="container d-flex justify-content-center align-items-center vh-100">
            <div className="w-100 text-center" style={{ maxWidth: "400px" }}>
                <div className="mb-4 d-flex justify-content-center">
                    <img
                        src="home.gif"
                        alt="Animated Logo"
                        style={{
                            width: "100%",
                        }}
                    />
                </div>
                <div className="card p-4 mt-3">
                    <form onSubmit={handleLogin}>
                        <div className="mb-3">
                            <input
                                type="email"
                                className="form-control"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="mb-3">
                            <input
                                type="password"
                                className="form-control"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary w-100">Login</button>
                    </form>
                </div>
            </div>
            {error && (
                <div
                    className="alert alert-danger alert-dismissible fade show position-fixed bottom-0 start-50 translate-middle-x mb-3 w-100 text-center"
                    style={{ maxWidth: "400px" }}
                    role="alert"
                >
                    {error}
                    <button
                        type="button"
                        className="btn-close"
                        onClick={dismissAlert}
                        aria-label="Close"
                    ></button>
                </div>
            )}
        </div>
    );
};
export default Login;