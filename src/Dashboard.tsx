import { useState, useEffect, useRef } from "react";
// import ReactDOM from "react-dom/client";
// import { Button } from "react-bootstrap";
import "./Dashboard.css";

const modules = [
  { id: 1, name: "To-Do", logo: "📌" },
  { id: 2, name: "Poznámky", logo: "📋" },
  { id: 3, name: "Kalendář", logo: "🐕" },
  { id: 4, name: "Velká kniha pohádek", logo: "🧚" },
  { id: 5, name: "Bodová ohodnocení", logo: "🎁" },
  { id: 6, name: "Remainder", logo: "🔔" },
];

async function fetchModuleData(moduleId: number) {
  const token = localStorage.getItem("sessionToken");

  if (!token) {
    window.location.href = "/";
    return 0;
  }

  const response = await fetch(
    `https://data-server-892925846021.europe-central2.run.app/module-data/${moduleId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    if (![400, 404, 500].includes(response.status)) {
      localStorage.removeItem("sessionToken");
      window.location.href = "/";
    }
    console.error(`Fetch error: ${response.statusText}`);
    return 0;
  }
  const storedDataString = localStorage.getItem(`moduleData-${moduleId}`);
  const storedData = storedDataString ? JSON.parse(storedDataString) : [];
  console.log(`X_moduleData-${moduleId}`, JSON.stringify(storedData));

  const serverResponse = await response.json();
  const newData = serverResponse.data || []; // Zajistí, že data bude minimálně prázdné pole

  // Funkce pro seřazení pole podle "id"
  const sortById = (array: any) => array.sort((a: any, b: any) => a.id - b.id);

  // Seřazení obou datových sad
  const sortedStoredData = sortById([...storedData]); // Klonuje a seřadí
  const sortedNewData = sortById([...newData]);

  if (JSON.stringify(sortedStoredData) !== JSON.stringify(sortedNewData)) {
    // Update local storage with the fetched data
    localStorage.setItem(`moduleData-${moduleId}`, JSON.stringify(newData));
    console.log(`moduleData-${moduleId}`, JSON.stringify(newData));
    return 1;
  }
  return 0;
}

async function syncModuleData(moduleId: number) {
  const token = localStorage.getItem("sessionToken");

  if (!token) {
    window.location.href = "/";
    return 0;
  }

  // Retrieve local storage data and filter for edited items
  const localData = JSON.parse(
    localStorage.getItem(`moduleData-${moduleId}`) || "[]"
  );
  const editedData = localData.filter(
    (item: any) => item?.edit === true || item?.edit === undefined
  );

  if (editedData.length === 0) {
    // No data to sync
    return 0;
  }

  const response = await fetch(
    "https://data-server-892925846021.europe-central2.run.app/module-data",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ moduleId, data: editedData }),
    }
  );

  if (!response.ok) {
    localStorage.removeItem("sessionToken");
    window.location.href = "/";
    return 0;
  }

  // Optionally handle response from server
  const serverResponse = await response.json();
  console.log("Sync response:", serverResponse);
  return 1;
}

interface SidebarProps {
  activeModule: number | null;
  setActiveModule: React.Dispatch<React.SetStateAction<number | null>>;
  areNewData: boolean | null;
  setNewDataAlert: React.Dispatch<React.SetStateAction<boolean | null>>;
}

function Sidebar({
  activeModule,
  setActiveModule,
  areNewData,
  setNewDataAlert,
}: SidebarProps) {
  const [isSidebarVisible, setSidebarVisible] = useState(true);
  const [isSynchronized, setSynchronize] = useState(true);

  // fetch when change
  // sync interval
  useEffect(() => {
    if (activeModule !== null) {
      const fetchDataAndSync = async () => {
        const result = await fetchModuleData(activeModule);
        if (result === 1) setNewDataAlert(true);
        else setNewDataAlert(false);
        const syncInterval = setInterval(async () => {
          if (isSynchronized !== true) {
            let result = await syncModuleData(activeModule);
            if (result === 1) {
              setSynchronize(false);
              result = await fetchModuleData(activeModule);
              if (result !== 1) {
                setNewDataAlert(true);
              } else {
                setSynchronize(true);
              }
            }
          }
        }, 1000);

        // Vyčištění při odmountování komponenty
        return () => clearInterval(syncInterval);
      };

      fetchDataAndSync();
    }
  }, [activeModule, isSynchronized]);

  return (
    <>
      <div
        className={`sidebar-container ${
          isSidebarVisible ? "" : "collapsed"
        } bg-light`}
        style={{ height: "100vh" }}
      >
        <button
          className="toggle-button btn btn-primary"
          onClick={() => setSidebarVisible(!isSidebarVisible)}
        >
          {isSidebarVisible ? "<-" : "->"}
        </button>
        {isSidebarVisible && (
          <div className="sidebar">
            <div className="list-group">
              {modules.map((module) => (
                <button
                  key={module.id}
                  className={`list-group-item list-group-item-action ${
                    activeModule === module.id ? "active active-primary" : ""
                  }`}
                  onClick={() => setActiveModule(module.id)}
                >
                  <span className="me-2">{module.logo}</span>
                  {module.name}
                </button>
              ))}
            </div>
            <p className="mt-2">
              Status:
              {areNewData ? (
                <b className="ms-1 fs-3">🆕</b>
              ) : isSynchronized ? (
                <b className="ms-1 fs-5">✅</b>
              ) : (
                <b className="ms-1 fs-5">❌</b>
              )}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

interface ToDoProps {
  name: string;
}

function ToDo({ name }: ToDoProps) {
  const [tasks, setTasks] = useState<
    {
      id: number;
      text: string;
      completed: boolean;
      edit: boolean;
      name: string;
    }[]
  >([]);
  const [newTask, setNewTask] = useState("");

  // Načtení úkolů z Local Storage při prvním renderu
  useEffect(() => {
    const storedData = localStorage.getItem(`moduleData-1`);
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      const filteredTasks = parsedData.filter(
        (task: any) => task.name === name
      );
      setTasks(filteredTasks);
    }
  }, [name]);

  // Uložení úkolů do Local Storage při každé změně úkolů
  useEffect(() => {
    const storedData = localStorage.getItem(`moduleData-1`);
    const existingData = storedData ? JSON.parse(storedData) : [];
    const updatedData = [
      ...existingData.filter((task: any) => task.name !== name),
      ...tasks,
    ];
    localStorage.setItem(`moduleData-1`, JSON.stringify(updatedData));
  }, [tasks, name]);

  const addTask = () => {
    if (newTask.trim()) {
      setTasks([
        ...tasks,
        {
          id: Date.now(),
          text: newTask.trim(),
          completed: false,
          edit: true,
          name,
        },
      ]);
      setNewTask("");
    }
  };

  const handleCheckboxChange = (taskId: number) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId
          ? { ...task, completed: !task.completed, edit: true }
          : task
      )
    );
  };

  const removeCompletedTasks = () => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.completed ? { ...task, text: "", edit: true } : task
      )
    );
  };

  return (
    <div>
      <h2>{name}</h2>
      <div style={{ display: "flex", gap: "0.5%" }}>
        <input
          type="task"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Přidej nový úkol"
          className="form-control"
          style={{ flex: 1, fontSize: "18px", minWidth: "200px" }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              addTask();
            }
          }}
        />
        <button
          className="btn btn-primary"
          style={{ fontSize: "18px" }}
          onClick={addTask}
        >
          +
        </button>
      </div>
      <ul style={{ listStyleType: "none", padding: 0 }}>
        {[...tasks]
          .filter((task) => task.text.trim() !== "") // Filtruje úkoly s neprázdným textem
          .sort((a, b) => Number(a.completed) - Number(b.completed))
          .map((task) => (
            <li
              key={task.id}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "5px",
                marginTop: "5px",
                textDecoration: task.completed ? "line-through" : "none",
                color: task.completed ? "gray" : "black",
              }}
            >
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => handleCheckboxChange(task.id)}
                style={{ width: "20px", height: "20px", marginRight: "20px" }}
              />
              <span style={{ fontSize: "18px" }}>{task.text}</span>
            </li>
          ))}
      </ul>
      <button className="btn btn-secondary" onClick={removeCompletedTasks}>
        Smazat hotové
      </button>
    </div>
  );
}

function Notes() {
  const [notes, setNotes] = useState<any[]>(() => {
    const savedNotes = localStorage.getItem("moduleData-2");
    try {
      return savedNotes ? JSON.parse(savedNotes) : [];
    } catch (error) {
      console.error("Failed to parse saved notes:", error);
      return [];
    }
  });

  const textAreaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  useEffect(() => {
    // Uloží poznámky do localStorage
    localStorage.setItem("moduleData-2", JSON.stringify(notes));
  }, [notes]);

  const handleTextChange = (index: number, value: string) => {
    const updatedNotes = [...notes];
    updatedNotes[index] = {
      ...updatedNotes[index],
      text: value,
      edit: true, // Zaznamená úpravu poznámky
    };

    setNotes(updatedNotes);
  };

  const addNote = () => {
    const newNote = {
      id: Date.now(), // Unikátní ID pro poznámku
      text: "", // Výchozí text
      edit: false, // Nová poznámka není upravená
    };
    setNotes([...notes, newNote]);
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = "auto"; // Reset výšky
    e.target.style.height = `${e.target.scrollHeight}px`; // Nastavení na výšku obsahu
  };

  return (
    <div style={{ padding: "2%", maxWidth: "60%", margin: "0 auto" }}>
      <h2>Poznámky</h2>
      {notes.map((note: any, index: number) => (
        <textarea
          key={note.id}
          ref={(el) => (textAreaRefs.current[index] = el)}
          value={note.text}
          onChange={(e) => {
            handleTextChange(index, e.target.value);
            autoResize(e);
          }}
          className="form-control"
          placeholder={`Poznámka ${index + 1}`}
          style={{
            minHeight: "100px",
            marginBottom: "10px",
            padding: "10px",
            fontSize: "16px",
            resize: "none", // Zakázání manuální změny velikosti
            overflow: "hidden", // Skrytí posuvníků
          }}
        />
      ))}
      <button
        onClick={addNote}
        className="btn btn-primary"
        style={{
          cursor: "pointer",
          padding: "10px 20px",
          fontSize: "16px",
        }}
      >
        + Přidat poznámku
      </button>
    </div>
  );
}

function Calendar() {
  const [days, setDays] = useState<Date[]>([]);
  const [calendarData, setCalendarData] = useState<any[]>(() => {
    const savedData = localStorage.getItem("moduleData-3");
    try {
      return savedData ? JSON.parse(savedData) : [];
    } catch (error) {
      console.error("Failed to parse saved calendar data:", error);
      return [];
    }
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);

  const symbols = ["👀", "😈", "💣", "🩸", "🧴", "🤧", "🍊"];
  const symbolColors: { [key: string]: string } = {
    "👀": "black",
    "😈": "purple",
    "💣": "black",
    "🩸": "red",
    "🧴": "yellow",
    "🤧": "blue",
    "🍊": "orange",
  };

  useEffect(() => {
    const today = new Date();
    const start = new Date();
    const end = new Date();
    start.setDate(today.getDate() - 15);
    end.setDate(today.getDate() + 15);

    const generatedDays: Date[] = [];
    let current = new Date(start);
    while (current <= end) {
      generatedDays.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    setDays(generatedDays);
  }, []);

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const handleDayClick = (day: Date) => {
    const dayKey = day.toISOString().split("T")[0];
    setSelectedDay(dayKey);
    const existingEntry = calendarData.find((entry) => entry.id === dayKey);
    setSelectedSymbols(existingEntry?.text || []);
    const modal = document.getElementById("symbolModal");
    if (modal) modal.style.display = "block";
  };

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol].slice(0, 8)
    );
  };

  const handleSave = () => {
    if (selectedDay) {
      const updatedData = calendarData.filter(
        (entry) => entry.id !== selectedDay
      );
      updatedData.push({ id: selectedDay, text: selectedSymbols, edit: true });
      setCalendarData(updatedData);

      localStorage.setItem("moduleData-3", JSON.stringify(updatedData));
    }

    const modal = document.getElementById("symbolModal");
    if (modal) modal.style.display = "none";
  };

  return (
    <div className="container my-4" style={{ padding: "0.5%" }}>
      <h2 className="text-center mb-4">Kalendář</h2>
      <div
        className="d-grid gap-3"
        style={{
          gridTemplateColumns: "repeat(7, 1fr)",
          display: "grid",
        }}
      >
        {days.map((day, index) => {
          const dayKey = day.toISOString().split("T")[0];
          const symbolsForDay =
            calendarData.find((entry) => entry.id === dayKey)?.text || [];

          return (
            <button
              key={index}
              className={`btn text-center ${
                isToday(day)
                  ? "btn-primary text-white"
                  : "btn-outline-secondary"
              }`}
              style={{
                padding: "15px",
                minHeight: "120px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
              onClick={() => handleDayClick(day)}
            >
              <div className="fw-bold mb-2">
                {day.toLocaleDateString("cs-CZ", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  gap: "2px",
                }}
              >
                {Array(7)
                  .fill(null)
                  .map((_, idx) => (
                    <span
                      key={idx}
                      style={{
                        color: symbolColors[symbolsForDay[idx]] || "inherit",
                        fontWeight: "bold",
                        fontSize: "16px",
                      }}
                    >
                      {symbolsForDay[idx] || "\u00A0" /* Mezera */}
                    </span>
                  ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Modální okno */}
      <div
        id="symbolModal"
        className="modal"
        style={{ display: "none", position: "fixed", zIndex: 1050 }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Vyberte symboly</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() =>
                  (document.getElementById("symbolModal")!.style.display =
                    "none")
                }
              ></button>
            </div>
            <div className="modal-body">
              <div className="d-flex flex-wrap gap-2">
                {symbols.map((symbol) => (
                  <button
                    key={symbol}
                    className={`btn ${
                      selectedSymbols.includes(symbol)
                        ? "btn-primary"
                        : "btn-outline-secondary"
                    }`}
                    style={{ color: symbolColors[symbol] }}
                    onClick={() => toggleSymbol(symbol)}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  (document.getElementById("symbolModal")!.style.display =
                    "none")
                }
              >
                Zavřít
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
              >
                Uložit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PointsProps {
  name: string;
}

interface LogEntry {
  id: number;
  change: number;
  text: string;
  name: string;
  edit: boolean;
}

function Points({ name }: PointsProps) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [text, setText] = useState<string>("");
  const [change, setChange] = useState<number>(0);
  const [dynamicPoints, setDynamicPoints] = useState<number>(0);

  useEffect(() => {
    const storedData = localStorage.getItem("moduleData-5");
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        if (Array.isArray(parsedData)) {
          const filteredLog = parsedData.filter(
            (entry: LogEntry) => entry.name === name && entry.text !== ""
          );
          setLog(filteredLog);
          setDynamicPoints(
            filteredLog.reduce((total, entry) => total + entry.change, 0)
          );
        } else {
          console.error("Parsed data is not an array:", parsedData);
        }
      } catch (error) {
        console.error("Failed to parse stored data:", error);
      }
    }
  }, [name]);

  useEffect(() => {
    const storedData = localStorage.getItem("moduleData-5");
    const existingData = storedData ? JSON.parse(storedData) : [];
    const updatedData = Array.isArray(existingData)
      ? [
          ...existingData.filter((entry: LogEntry) => entry.name !== name),
          ...log,
        ]
      : log;
    localStorage.setItem("moduleData-5", JSON.stringify(updatedData));
  }, [log]);

  const handleAddLog = () => {
    if (!text.trim()) return;

    const newLog: LogEntry = {
      id: Date.now(),
      change,
      text: text.slice(0, 60),
      name,
      edit: true,
    };

    setLog([newLog, ...log]);
    setText("");
    setChange(0);
  };

  const handlePointChange = (amount: number) => {
    setChange((prev) => prev + amount);
    setDynamicPoints((prev) => prev + amount);
  };

  const handleVeto = (id: number) => {
    const updatedLog = log.map((entry) =>
      entry.id === id ? { ...entry, text: "", edit: true } : entry
    );
    setLog(updatedLog);
  };

  return (
    <div>
      <h2 className="text-center">{name}</h2>
      <div className="d-flex justify-content-center align-items-center mb-3">
        <button
          className="btn btn-danger me-2"
          onClick={() => handlePointChange(-1)}
        >
          -
        </button>
        <span className="fs-4 mx-3">{dynamicPoints}</span>
        <button
          className="btn btn-success"
          onClick={() => handlePointChange(1)}
        >
          +
        </button>
      </div>
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 60))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleAddLog();
            }
          }}
          placeholder="Důvod (max 60 znaků)"
        />
      </div>
      <button className="btn btn-primary mb-4" onClick={handleAddLog}>
        Propsat záznam
      </button>

      <div className="table-responsive">
        <table
          className="table table-bordered table-hover mx-auto"
          style={{ maxWidth: "100%" }}
        >
          <thead className="table-light">
            <tr>
              <th style={{ width: "20%" }}>Rozdíl</th>
              <th style={{ width: "60%" }}>Důvod</th>
              <th style={{ width: "20%" }}>Akce</th>
            </tr>
          </thead>
          <tbody>
            {log
              .filter((entry) => entry.text !== "")
              .map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.change}</td>
                  <td>{entry.text}</td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleVeto(entry.id)}
                    >
                      Veto
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface Tale {
  name: string;
  preview: string;
}

function Tales() {
  const [tales, setTales] = useState<Tale[]>([]);

  useEffect(() => {
    const fetchTales = async () => {
      try {
        // Fetching the list of files from the /public/tales directory (requires API or predefined list)
        const response = await fetch("/tales/manifest.json");
        const data: Tale[] = await response.json();
        setTales(data);
      } catch (error) {
        console.error("Failed to load tales", error);
      }
    };

    fetchTales();
  }, []);

  const handleTaleClick = async (name: string) => {
    try {
      const response = await fetch(`/tales/${name}.txt`);
      const text = await response.text();

      // blob temp data
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      // blob in the same tab, making it compatible on phones
      window.location.href = url;
    } catch (error) {
      console.error("Failed to load tale content", error);
      alert(
        "An error occurred while loading the tale content. Please try again."
      );
    }
  };

  return (
    <div className="tales-container d-flex flex-wrap gap-3 p-3">
      {tales.map((tale, index) => (
        <div
          key={index}
          className="card shadow-sm border-0 rounded-3"
          style={{
            width: "18rem",
            cursor: "pointer",
            transition: "transform 0.2s",
          }}
          onClick={() => handleTaleClick(tale.name)}
          onMouseEnter={(e) =>
            (e.currentTarget.style.transform = "scale(1.05)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <div className="overflow-hidden" style={{ height: "150px" }}>
            <img
              src={`/tales/${tale.name}.webp`}
              alt={tale.name}
              className="card-img-top h-100 w-100"
              style={{ objectFit: "cover" }}
            />
          </div>
          <div className="card-body text-center bg-light">
            <p className="card-text mb-0">{tale.preview}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const [activeModule, setActiveModule] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [areNewData, setNewDataAlert] = useState<boolean | null>(false);

  useEffect(() => {
    const token = localStorage.getItem("sessionToken");

    if (!token) {
      window.location.href = "/";
      return;
    }

    // Verify token
    fetch(
      "https://data-server-892925846021.europe-central2.run.app/dashboard",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unauthorized");
        }
        return response.json();
      })
      .then(() => {
        setIsAuthenticated(true);
      })
      .catch(() => {
        localStorage.removeItem("sessionToken");
        window.location.href = "/";
      });
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <img src="home_cropped.gif" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="dashboard" style={{ display: "flex", height: "100vh" }}>
      <Sidebar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        areNewData={areNewData}
        setNewDataAlert={setNewDataAlert}
      />
      <div
        className="main-content"
        style={{
          flex: 1,
          padding: "1%",
          transition: "margin-left 0.3s",
          marginLeft: "2%",
        }}
      >
        {activeModule === null ? (
          <div>
            <p style={{ fontSize: "30px" }}>Vyber modul</p>
          </div>
        ) : null}
        {activeModule === 1 ? (
          <div
            style={{
              display: "flex",
              height: "100%",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                flex: 1,
                borderRight: "1px solid silver",
                textAlign: "center",
                padding: "2%",
              }}
            >
              <ToDo name="Anička" />
            </div>
            <div style={{ flex: 1, textAlign: "center", padding: "2%" }}>
              <ToDo name="Pepíček" />
            </div>
          </div>
        ) : null}
        {activeModule === 2 ? <Notes /> : null}
        {activeModule === 3 ? <Calendar /> : null}
        {activeModule === 4 ? <Tales /> : null}
        {activeModule === 5 ? (
          <div
            style={{
              display: "flex",
              height: "100%",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                flex: 1,
                borderRight: "1px solid silver",
                textAlign: "center",
                padding: "2%",
                paddingLeft: "2%",
                paddingRight: "2%",
              }}
            >
              <Points name="Anička" />
            </div>
            <div
              style={{
                flex: 1,
                textAlign: "center",
                padding: "2%",
                paddingLeft: "2%",
              }}
            >
              <Points name="Pepíček" />
            </div>
          </div>
        ) : null}
        {activeModule === 6 ? "TBD" : null}
      </div>
    </div>
  );
}
export default Dashboard;
