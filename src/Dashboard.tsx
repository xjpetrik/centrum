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
  { id: 7, name: "Nastavení", logo: "⚙️" },
];

let colorsList: Record<string, { hexColor: string }> = {};

const loadColors = () => {
  const savedColors = localStorage.getItem("prefColors");
  if (!savedColors) return;
  colorsList = JSON.parse(savedColors);
  for (const [colorType, { hexColor }] of Object.entries(colorsList)) {
    setNewColor(colorType, hexColor);
  }
};

const hexToRgb = (hex: string) => {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r}, ${g}, ${b}`;
};

const setNewColor = (colorType: string, hexColor: string) => {
  document.documentElement.style.setProperty(colorType, hexColor); // btns
  document.documentElement.style.setProperty(
    `${colorType}-rgb`,
    hexToRgb(hexColor)
  ); // txt
  colorsList[colorType] = { hexColor };
};

async function fetchModuleData(moduleId: number) {
  const token = localStorage.getItem("sessionToken");

  if (!token) {
    window.location.href = "/centrum/";
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
      window.location.href = "/centrum/";
    }
    console.error(`Fetch error: ${response.statusText}`);
    return 0;
  }
  const storedDataString = localStorage.getItem(`moduleData-${moduleId}`);
  const storedData = storedDataString ? JSON.parse(storedDataString) : [];

  const serverResponse = await response.json();
  const newData = serverResponse.data || [];

  const sortById = (array: any) => array.sort((a: any, b: any) => a.id - b.id);

  const sortedStoredData = sortById([...storedData]);
  const sortedNewData = sortById([...newData]);

  if (JSON.stringify(sortedStoredData) !== JSON.stringify(sortedNewData)) {
    // update
    localStorage.setItem(`moduleData-${moduleId}`, JSON.stringify(newData));
    console.log(`moduleData-${moduleId}`, JSON.stringify(newData));
    const normalizedStoredData = sortedStoredData.map((item: any) => ({
      ...item,
      edit: false,
    }));
    if (JSON.stringify(normalizedStoredData) !== JSON.stringify(sortedNewData))
      return 1;
    return 0;
  }
  return 0;
}

async function syncModuleData(moduleId: number) {
  const token = localStorage.getItem("sessionToken");

  if (!token) {
    window.location.href = "/centrum/";
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
    window.location.href = "/centrum/";
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

  const [isSyncInProgress, setSyncInProgress] = useState(false); // mutex

  useEffect(() => {
    if (activeModule !== null) {
      const fetchDataAndSync = async () => {
        const result = await fetchModuleData(activeModule);
        if (result === 1) {
          setNewDataAlert(true);
        } else {
          setNewDataAlert(false);
        }
        setSynchronize(true);

        const syncLoop = async () => {
          if (isSyncInProgress) return; // race condition opatření
          setSyncInProgress(true);

          try {
            if (isSynchronized) {
              let result = await syncModuleData(activeModule);
              if (result === 1) {
                setSynchronize(false);
                result = await fetchModuleData(activeModule);
                if (result !== 0) {
                  setNewDataAlert(true);
                } else {
                  setSynchronize(true);
                }
              }
            }
          } finally {
            setSyncInProgress(false);
          }

          setTimeout(syncLoop, 2000);
        };

        syncLoop();
      };

      fetchDataAndSync();
    }
  }, [activeModule]);

  return (
    <div
      className={`sidebar-container shadow ${
        isSidebarVisible ? "" : "collapsed"
      } bg-light position-relative`}
    >
      <button
        className="toggle-button btn btn-primary fw-bold py-2 px-3"
        onClick={() => setSidebarVisible(!isSidebarVisible)}
      >
        {isSidebarVisible ? "⬅" : "➡"}
      </button>
      {isSidebarVisible && (
        <div className="sidebar p-3">
          <div className="list-group">
            {modules.map((module) => (
              <button
                key={module.id}
                className={`list-group-item list-group-item-action d-flex align-items-center ${
                  activeModule === module.id ? "active" : ""
                }`}
                onClick={() => setActiveModule(module.id)}
              >
                <span className="me-2 fs-5">{module.logo}</span>
                <span className="fs-5">{module.name}</span>
              </button>
            ))}
          </div>
          <div className="status-section mt-3 text-center">
            <p className="fw-semibold">
              <span className="text-muted">Status:</span>{" "}
              {areNewData ? (
                <span className="badge bg-warning text-dark fs-5">🆕</span>
              ) : isSynchronized ? (
                <span className="badge bg-success fs-5">✅</span>
              ) : (
                <span className="badge bg-danger fs-5">❌</span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
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
      <ul className="list-group my-1">
        {[...tasks]
          .filter((task) => task.text.trim() !== "") // Filtruje úkoly s neprázdným textem
          .sort((a, b) => Number(a.completed) - Number(b.completed))
          .map((task) => (
            <li
              key={task.id}
              className={`list-group-item d-flex align-items-center justify-content-start hover-none ${
                task.completed
                  ? "text-muted text-decoration-line-through hover-none"
                  : ""
              }`}
            >
              <div className="d-flex align-items-center gap-3">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => handleCheckboxChange(task.id)}
                  className="form-check-input fs-5"
                />
                <span className="text-start" style={{ fontSize: "1.1525rem" }}>
                  {task.text}
                </span>
              </div>
            </li>
          ))}
      </ul>
      <button className="btn btn-secondary mt-3" onClick={removeCompletedTasks}>
        Smazat hotové úkoly
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

  const [draftNotes, setDraftNotes] = useState<any[]>(notes); // Lokální stav pro okamžité zobrazení textu během psaní
  const textAreaRefs = useRef<(HTMLTextAreaElement | null)[]>([]); // Uloží refy pro všechny textarey
  const timeoutRefs = useRef<{ [key: number]: number | null }>({}); // Uloží timeouty pro debouncing

  // Automatické přizpůsobení výšky textarey při každém vykreslení
  useEffect(() => {
    textAreaRefs.current.forEach((textarea) => {
      if (textarea) {
        textarea.style.height = "auto"; // Reset výšky
        textarea.style.height = `${textarea.scrollHeight}px`; // Nastavení výšky podle obsahu
      }
    });
  }, [draftNotes]); // Spouští se při každé změně poznámky

  useEffect(() => {
    // Uloží poznámky do localStorage při aktualizaci
    localStorage.setItem("moduleData-2", JSON.stringify(notes));
  }, [notes]);

  const handleTextChange = (index: number, value: string) => {
    const updatedDraftNotes = [...draftNotes];
    updatedDraftNotes[index] = {
      ...updatedDraftNotes[index],
      text: value,
    };

    setDraftNotes(updatedDraftNotes); // Okamžitě zobrazí změny během psaní

    if (timeoutRefs.current[index]) {
      clearTimeout(timeoutRefs.current[index]!); // Zruší předchozí timeout, pokud existuje
    }

    // Nastaví timeout na 1 sekundu pro uložení změn
    timeoutRefs.current[index] = window.setTimeout(() => {
      const updatedNotes = [...notes];
      updatedNotes[index] = {
        ...updatedNotes[index],
        text: value,
        edit: true, // Označí poznámku jako upravenou po 1 sekundě nečinnosti
      };

      setNotes(updatedNotes); // Aktualizuje hlavní poznámky
      timeoutRefs.current[index] = null; // Reset timeoutu
    }, 1000); // 1 sekunda
  };

  const addNote = () => {
    const newNote = {
      id: Date.now(),
      text: "",
      edit: false,
    };
    setNotes([...notes, newNote]);
    setDraftNotes([...draftNotes, newNote]);
  };

  return (
    <div
      style={{
        padding: "2%",
        minWidth: "300px",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      <h2>Poznámky</h2>
      {draftNotes.map((note: any, index: number) => (
        <textarea
          key={note.id}
          ref={(el) => (textAreaRefs.current[index] = el)}
          value={note.text}
          onChange={(e) => handleTextChange(index, e.target.value)}
          className="form-control"
          placeholder={`Poznámka ${index + 1}`}
          style={{
            minHeight: "100px",
            marginBottom: "10px",
            padding: "10px",
            fontSize: "16px",
            resize: "none",
            overflow: "hidden",
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
    "♥": "red",
  };

  useEffect(() => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1); // 1. den měsíce
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    ); // Poslední den měsíce

    const startPaddingDays = (firstDayOfMonth.getDay() + 6) % 7; // Zarovnání na pondělí (0 = pondělí)

    const generatedDays: Date[] = [];

    // Přidání prázdných buněk na začátku
    for (let i = 0; i < startPaddingDays; i++) {
      generatedDays.push(new Date(0)); // Falešné datum jako placeholder
    }

    // Přidání skutečných dnů měsíce
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      generatedDays.push(new Date(today.getFullYear(), today.getMonth(), day));
    }

    setDays(generatedDays);
  }, []);

  const isToday = (date: Date) => {
    if (date.getTime() === 0) return false; // Ignorujeme placeholder dny
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const handleDayClick = (day: Date) => {
    if (day.getTime() === 0) return; // Kliknutí na placeholder dny se ignoruje
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
    <div className="container my-4">
      <h2 className="text-center mb-4">
        Kalendář{" "}
        <img
          src="pejsek.png"
          className="img-fluid"
          alt="Pejsek"
          style={{
            display: "inline-block",
            width: "1.6em",
            height: "1.6em",
            verticalAlign: "middle",
          }}
        />
      </h2>
      <div
        className="d-grid gap-2"
        style={{
          gridTemplateColumns: "repeat(7, 1fr)",
          display: "grid",
        }}
      >
        {days.map((day, index) => (
          <button
            key={index}
            className={`btn text-center shadow-sm ${
              isToday(day)
                ? "btn-primary text-white"
                : day.getTime() === 0
                ? "btn-secondary border-0"
                : "btn-outline-secondary text-dark"
            }`}
            style={{
              padding: "10%",
              minHeight: "120px",
              minWidth: "42px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              visibility: day.getTime() === 0 ? "hidden" : "visible",
            }}
            onClick={() => handleDayClick(day)}
          >
            {day.getTime() !== 0 && (
              <>
                <div className="fw-bold small mb-2 text-uppercase">
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
                        className="fs-6"
                        style={{
                          color:
                            symbolColors[
                              calendarData.find(
                                (entry) =>
                                  entry.id === day.toISOString().split("T")[0]
                              )?.text[idx] || ""
                            ] || "inherit",
                          fontWeight: "bold",
                        }}
                      >
                        {
                          calendarData.find(
                            (entry) =>
                              entry.id === day.toISOString().split("T")[0]
                          )?.text[idx] /* Mezera */
                        }
                      </span>
                    ))}
                </div>
              </>
            )}
          </button>
        ))}
      </div>

      {/* Modální okno */}
      <div
        id="symbolModal"
        className="modal"
        style={{ display: "none", position: "fixed" }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">Vyber symboly</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() =>
                  (document.getElementById("symbolModal")!.style.display =
                    "none")
                }
              ></button>
            </div>
            <div className="modal-body bg-light">
              <div className="d-flex flex-wrap gap-3 justify-content-center">
                {symbols.map((symbol) => (
                  <button
                    key={symbol}
                    className={`btn fs-5 ${
                      selectedSymbols.includes(symbol)
                        ? "btn-primary shadow"
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
            <div className="modal-footer bg-light">
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

function Settings() {
  // dark mode
  // změna primary color bootstrap
  // změna hesla
  // odhlásit ze všech relací
  // změna fontu
  // statistika
  // counter splněných úkolů na tomto zařízení
  // counter udělaných pejskovo prodecur na tomto zařízení
  // counter přečtených pohádek
  // counter přidaných/odebraných bodů na tomto zařízení
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const storedMode = localStorage.getItem("darkMode");
    return storedMode === "true";
  });
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [passwordChangeMessage, setPasswordChangeMessage] = useState<
    string | null
  >(null);
  const [colorChangeMessage, setColorChangeMessage] = useState<string | null>(
    null
  );

  // Toggle dark mode and store preference
  const handleDarkModeToggle = () => {
    setDarkMode((prevMode) => {
      const newMode = !prevMode;
      localStorage.setItem("darkMode", newMode.toString());
      document.body.classList.toggle("bg-dark", newMode);
      document.body.classList.toggle("text-light", newMode);
      return newMode;
    });
  };

  // Change password function
  const handleChangePassword = () => {
    if (!newPassword || !confirmPassword) {
      setPasswordChangeMessage("Vyplňte obě pole.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeMessage("Hesla se neshodují.");
      return;
    }

    setPasswordChangeMessage("Probíhá změna hesla...");
    setTimeout(() => {
      setPasswordChangeMessage("Heslo bylo úspěšně změněno.");
      setNewPassword("");
      setConfirmPassword("");
    }, 1000);
  };

  const handleSaveColors = () => {
    localStorage.setItem("prefColors", JSON.stringify(colorsList));
    setColorChangeMessage("Barvy úspěšně změněny!");
  };

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("bg-dark", "text-light");
    }
  }, [darkMode]);

  return (
    <div
      className={`container py-4 ${
        darkMode ? "bg-dark text-light" : "bg-white text-dark"
      }`}
    >
      <div className="mb-4">
        <h1 className="text-primary font-weight-bold mb-0">Vzhled</h1>
        <hr className="mb-4" />
        <div className="border border-primary rounded px-3 py-3 mb-3">
          <h2>Dark Mode</h2>
          <div className="form-check form-switch mb-2 fs-4">
            <input
              className="form-check-input"
              type="checkbox"
              id="darkModeSwitch"
              checked={darkMode}
              onChange={handleDarkModeToggle}
            />
            <label className="form-check-label" htmlFor="darkModeSwitch">
              {darkMode ? "Zapnuto" : "Vypnuto"}
            </label>
          </div>
        </div>
        <div className="border border-primary rounded px-3 py-3">
          <h2>Změna barev</h2>
          <h4 className="bg-primary rounded px-2 py-1">Primární</h4>
          <input
            type="color"
            onChange={(e) => setNewColor("--bs-primary", e.target.value)}
            value={colorsList["--bs-primary"]?.hexColor || "#007bff"} // Výchozí modrá barva
            className="input-group input-group-sm mb-3"
          />
          <h4 className="bg-secondary rounded px-2 py-1">Sekundární</h4>
          <input
            type="color"
            onChange={(e) => setNewColor("--bs-secondary", e.target.value)}
            value={colorsList["--bs-secondary"]?.hexColor || "#6c757d"} // Výchozí šedá barva
            className="input-group input-group-sm mb-3"
          />
          <h4 className="bg-success rounded px-2 py-1">Úspěšně</h4>
          <input
            type="color"
            onChange={(e) => setNewColor("--bs-success", e.target.value)}
            value={colorsList["--bs-success"]?.hexColor || "#28a745"} // Výchozí zelená barva
            className="input-group input-group-sm mb-3"
          />
          <h4 className="bg-danger rounded px-2 py-1">Chyba</h4>
          <input
            type="color"
            onChange={(e) => setNewColor("--bs-danger", e.target.value)}
            value={colorsList["--bs-danger"]?.hexColor || "#dc3545"} // Výchozí červená barva
            className="input-group input-group-sm mb-3"
          />
          <h4 className="bg-warning rounded px-2 py-1">Varování</h4>
          <input
            type="color"
            onChange={(e) => setNewColor("--bs-warning", e.target.value)}
            value={colorsList["--bs-warning"]?.hexColor || "#ffc107"} // Výchozí žlutá barva
            className="input-group input-group-sm mb-3"
          />
          <button onClick={handleSaveColors} className="btn btn-primary">
            Uložit barvy
          </button>
        </div>
      </div>
      <h1 className="text-primary font-weight-bold mb-0 mt-4">Bezpečnost</h1>
      <hr className="mb-4" />
      <div className="border border-primary rounded px-3 py-3 mb-3">
        <h2>Změna hesla</h2>
        <div className="mb-2">
          <input
            type="password"
            className="form-control"
            placeholder="Nové heslo"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <input
            type="password"
            className="form-control"
            placeholder="Potvrzení hesla"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <button
          className="btn btn-primary w-100 mb-2"
          onClick={handleChangePassword}
        >
          Změnit heslo
        </button>
        {passwordChangeMessage && (
          <div className="mt-3 alert alert-info">{passwordChangeMessage}</div>
        )}
      </div>
      <div className="border border-primary rounded px-3 py-3 mb-3">
        <h2>Odhlásit ze všech relací</h2>
        <button
          className="btn btn-primary w-100 mb-2"
          onClick={handleChangePassword}
        >
          Smazat všechny sessions ze všech zařízení včetně tohoto
        </button>
      </div>

      <h1 className="text-primary font-weight-bold mb-0 mt-4">Statistika</h1>
      <hr className="mb-4" />
      <div className="border border-primary rounded px-3 py-3">
        <p>
          Počet splněných úkolů Anička:{" "}
          <span className="badge bg-primary text-dark fs-6">666</span> a
          Pepíček: <span className="badge bg-primary text-dark fs-6">666</span>{" "}
          <br />
          Počet dokonaných pejskovo procedur:{" "}
          <span className="badge bg-primary text-dark fs-6">666</span> <br />
          Počet přečtených pohádek na tomto zařízení:{" "}
          <span className="badge bg-primary text-dark fs-6">666</span> <br />
          Počet dohromady přečtených pohádek:{" "}
          <span className="badge bg-primary text-dark fs-6">666</span> <br />
          Počet přidaných/odebraných bodů na tomto zařízení:{" "}
          <span className="badge bg-primary text-dark fs-6">666</span> <br />
        </p>
      </div>
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
      window.location.href = "/centrum/";
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
        window.location.href = "/centrum/";
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

  loadColors();

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
        {activeModule === 7 ? <Settings /> : null}
      </div>
    </div>
  );
}
export default Dashboard;
