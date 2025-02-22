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
  { id: 6, name: "Domácnost", logo: "🏠" },
  { id: 7, name: "Expenses", logo: "💸" },
  { id: 8, name: "Watchlist", logo: "🍿" },
  { id: 9, name: "Nastavení", logo: "⚙️" },
];

let colorsList: Record<string, { hexColor: string }> = {};

const loadColors = () => {
  const savedColors = localStorage.getItem("prefColors");
  if (!savedColors) return;
  colorsList = JSON.parse(savedColors);
  for (const [colorType, { hexColor }] of Object.entries(colorsList))
    setNewColor(colorType, hexColor);
};

const hexToRgb = (hex: string) => {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r}, ${g}, ${b}`;
};

const setNewColor = (colorType: string, hexColor: string) => {
  document.documentElement.style.setProperty(colorType, hexColor);
  document.documentElement.style.setProperty(
    `${colorType}-rgb`,
    hexToRgb(hexColor)
  );
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

  // needs sort => server side and local side are working with json different way
  const sortById = (array: any) => array.sort((a: any, b: any) => a.id - b.id);

  const sortedStoredData = sortById([...storedData]);
  const sortedNewData = sortById([...newData]);

  if (JSON.stringify(sortedStoredData) !== JSON.stringify(sortedNewData)) {
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

  const localData = JSON.parse(
    localStorage.getItem(`moduleData-${moduleId}`) || "[]"
  );
  const editedData = localData.filter(
    (item: any) => item?.edit === true || item?.edit === undefined
  );

  if (editedData.length === 0) {
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

  const [isSyncInProgress, setSyncInProgress] = useState(false);
  useEffect(() => {
    if (activeModule !== null) {
      const fetchDataAndSync = async () => {
        const result = await fetchModuleData(activeModule);
        if (result === 1) setNewDataAlert(true);
        else setNewDataAlert(false);
        setSynchronize(true);
        const syncLoop = async () => {
          if (isSyncInProgress) return;
          setSyncInProgress(true);
          try {
            if (isSynchronized) {
              let result = await syncModuleData(activeModule);
              if (result === 1) {
                setSynchronize(false);
                result = await fetchModuleData(activeModule);
                if (result !== 0) setNewDataAlert(true);
                else setSynchronize(true);
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
        className="toggle-button btn btn-primary fw-bold "
        onClick={() => setSidebarVisible(!isSidebarVisible)}
        style={{ width: "100%", minWidth: "50px" }}
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

interface ModuleProps {
  activeModule: number | null;
  name: string;
}

function ToDo({ activeModule, name }: ModuleProps) {
  if (!name) return <p>err</p>;
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
  let module = `moduleData-${activeModule}`;
  useEffect(() => {
    const storedData = localStorage.getItem(module);
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      const filteredTasks = parsedData.filter(
        (task: any) => task.name === name
      );
      setTasks(filteredTasks);
    }
  }, [name]);

  useEffect(() => {
    const storedData = localStorage.getItem(module);
    const existingData = storedData ? JSON.parse(storedData) : [];
    const updatedData = [
      ...existingData.filter((task: any) => task.name !== name),
      ...tasks,
    ];
    localStorage.setItem(module, JSON.stringify(updatedData));
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
          .filter((task) => task.text.trim() !== "")
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

function Notes({ activeModule, name }: ModuleProps) {
  const [notes, setNotes] = useState<any[]>(() => {
    const savedNotes = localStorage.getItem(`moduleData-${activeModule}`);
    return savedNotes ? JSON.parse(savedNotes) : [];
  });

  const [draftNotes, setDraftNotes] = useState<any[]>(notes);
  const textAreaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const timeoutRefs = useRef<{ [key: number]: number | null }>({});
  useEffect(() => {
    textAreaRefs.current.forEach((textarea) => {
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    });
  }, [draftNotes]);
  useEffect(() => {
    localStorage.setItem(`moduleData-${activeModule}`, JSON.stringify(notes));
  }, [notes]);

  const handleTextChange = (index: number, value: string) => {
    const updatedDraftNotes = [...draftNotes];
    updatedDraftNotes[index] = {
      ...updatedDraftNotes[index],
      text: value,
    };

    setDraftNotes(updatedDraftNotes);
    if (timeoutRefs.current[index]) {
      clearTimeout(timeoutRefs.current[index]!);
    }

    timeoutRefs.current[index] = window.setTimeout(() => {
      const updatedNotes = [...notes];
      updatedNotes[index] = {
        ...updatedNotes[index],
        text: value,
        edit: true,
      };

      setNotes(updatedNotes);
      timeoutRefs.current[index] = null;
    }, 1000);
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
      <h2>{name}</h2>
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

function Calendar({ activeModule, name }: ModuleProps) {
  const [days, setDays] = useState<Date[]>([]);
  const [calendarData, setCalendarData] = useState<any[]>(() => {
    const savedData = localStorage.getItem(`moduleData-${activeModule}`);
    return savedData ? JSON.parse(savedData) : [];
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);

  const symbols = ["👀", "😈", "💣", "🩸", "🧴", "🤧", "🍊", "🚰"];
  const symbolColors: { [key: string]: string } = {
    "👀": "black",
    "😈": "purple",
    "💣": "black",
    "🩸": "red",
    "🧴": "yellow",
    "🤧": "blue",
    "🍊": "orange",
    "♥": "red",
    "🚰": "blue",
  };

  useEffect(() => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    );
    const startPaddingDays = (firstDayOfMonth.getDay() + 6) % 7;
    const generatedDays: Date[] = [];

    for (let i = 0; i < startPaddingDays; i++) {
      generatedDays.push(new Date(0));
    }

    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      generatedDays.push(new Date(today.getFullYear(), today.getMonth(), day));
    }

    setDays(generatedDays);
  }, []);

  const isToday = (date: Date) => {
    if (date.getTime() === 0) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const handleDayClick = (day: Date) => {
    if (day.getTime() === 0) return;
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

      localStorage.setItem(
        `moduleData-${activeModule}`,
        JSON.stringify(updatedData)
      );
    }

    const modal = document.getElementById("symbolModal");
    if (modal) modal.style.display = "none";
  };

  return (
    <div className="container my-4">
      <h2 className="text-center mb-4">
        {name}{" "}
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
                          )?.text[idx]
                        }
                      </span>
                    ))}
                </div>
              </>
            )}
          </button>
        ))}
      </div>

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

interface LogEntry {
  id: number;
  change: number;
  text: string;
  name: string;
  edit: boolean;
}

function Points({ activeModule, name }: ModuleProps) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [text, setText] = useState<string>("");
  const [change, setChange] = useState<number>(0);
  const [dynamicPoints, setDynamicPoints] = useState<number>(0);

  useEffect(() => {
    const storedData = localStorage.getItem(`moduleData-${activeModule}`);
    if (storedData) {
      try {
        // is this necessary?
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
    const storedData = localStorage.getItem(`moduleData-${activeModule}`);
    const existingData = storedData ? JSON.parse(storedData) : [];
    const updatedData = Array.isArray(existingData)
      ? [
          ...existingData.filter((entry: LogEntry) => entry.name !== name),
          ...log,
        ]
      : log;
    localStorage.setItem(
      `moduleData-${activeModule}`,
      JSON.stringify(updatedData)
    );
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
          <thead>
            <tr>
              <th className="randomthcico" style={{ width: "20%" }}>
                Rozdíl
              </th>
              <th className="randomthcico" style={{ width: "60%" }}>
                Důvod
              </th>
              <th className="randomthcico" style={{ width: "20%" }}>
                Akce
              </th>
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
  id: string;
  name: string;
  title: string;
  text: string;
  edit: boolean;
}

function Tales({ activeModule, name }: ModuleProps) {
  const [tales, setTales] = useState<Tale[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTale, setNewTale] = useState({ name: "", title: "", text: "" });

  useEffect(() => {
    const storedData = localStorage.getItem(`moduleData-${activeModule}`);
    if (storedData) {
      try {
        setTales(JSON.parse(storedData));
      } catch (error) {
        console.error("Failed to parse tales data:", error);
        setTales([]);
      }
    }
  }, []);

  const handleTaleClick = (id: string) => {
    const selectedTale = tales.find((tale) => tale.id === id);
    if (!selectedTale) {
      alert("Tale not found!");
      return;
    }

    try {
      const blob = new Blob([selectedTale.text], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);

      window.location.href = url;
    } catch (error) {
      console.error("Failed to load tale content", error);
      alert(
        "An error occurred while loading the tale content. Please try again."
      );
    }
  };

  const handleAddTale = () => {
    if (!newTale.name || !newTale.title || !newTale.text) {
      alert("Vyplňte všechna pole!");
      return;
    }

    const newId = Date.now().toString();
    const updatedTales = [
      ...tales,
      {
        id: newId,
        name: newTale.name,
        title: newTale.title,
        text: newTale.text,
        edit: true,
      },
    ];
    setTales(updatedTales);
    localStorage.setItem(
      `moduleData-${activeModule}`,
      JSON.stringify(updatedTales)
    );

    setNewTale({ name: "", title: "", text: "" });
    setModalVisible(false);
  };

  return (
    <div className="container">
      <h1>{name}</h1>
      <div className="tales-container d-flex flex-wrap gap-3 p-3">
        {tales.map((tale) => (
          <div
            key={tale.id}
            className="card shadow-sm border-0 rounded-3"
            style={{
              width: "18rem",
              cursor: "pointer",
              transition: "transform 0.2s",
            }}
            onClick={() => handleTaleClick(tale.id)}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = "scale(1.05)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <div className="overflow-hidden" style={{ height: "100%" }}>
              <img
                src={`/centrum/tales/${tale.name}.webp`}
                alt={tale.name}
                className="card-img-top h-100 w-100"
                style={{ objectFit: "cover" }}
              />
            </div>
            <div className="card-body text-center bg-primary">
              <p className="card-title text-white fs-5 fw-bold">{tale.title}</p>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => setModalVisible(true)}
        className="btn btn-primary mt-5 fs-5"
      >
        Přidat pohádku
      </button>

      {modalVisible && (
        <div
          className="modal"
          style={{
            display: "block",
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1050,
            backgroundColor: "white",
            borderRadius: "8px",
            maxWidth: "500px",
            width: "100%",
            boxShadow: "0 5px 15px rgba(0,0,0,.5)",
          }}
        >
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">Přidat novou pohádku</h5>
            <button
              type="button"
              className="btn-close"
              onClick={() => setModalVisible(false)}
            ></button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label htmlFor="taleName" className="form-label">
                Název souboru
              </label>
              <input
                type="text"
                id="taleName"
                className="form-control"
                value={newTale.name}
                onChange={(e) =>
                  setNewTale({ ...newTale, name: e.target.value })
                }
              />
            </div>
            <div className="mb-3">
              <label htmlFor="taleTitle" className="form-label">
                Název pohádky
              </label>
              <input
                type="text"
                id="taleTitle"
                className="form-control"
                value={newTale.title}
                onChange={(e) =>
                  setNewTale({ ...newTale, title: e.target.value })
                }
              />
            </div>
            <div className="mb-3">
              <label htmlFor="taleText" className="form-label">
                Text pohádky
              </label>
              <textarea
                id="taleText"
                className="form-control"
                rows={5}
                value={newTale.text}
                onChange={(e) =>
                  setNewTale({ ...newTale, text: e.target.value })
                }
              ></textarea>
            </div>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-secondary"
              onClick={() => setModalVisible(false)}
            >
              Zavřít
            </button>
            <button className="btn btn-primary" onClick={handleAddTale}>
              Uložit pohádku
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Settings() {
  // TODO REWORK
  // ------------------------------------------------------------------------------------------------<<---<<--<<
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
  const [colorChangeMessage, setColorChangeMessage] = useState<string | null>(
    null
  );
  const [darkMode, setDarkMode] = useState(localStorage.getItem("darkMode"));

  const handleDarkModeToggle = () => {
    let currentTheme = document.body.getAttribute("data-bs-theme");
    currentTheme = currentTheme === "nodark" ? "dark" : "nodark";
    document.body.setAttribute("data-bs-theme", currentTheme);
    setDarkMode(currentTheme);
    localStorage.setItem("darkMode", currentTheme);
  };

  const handleSaveColors = () => {
    localStorage.setItem("prefColors", JSON.stringify(colorsList));
    setColorChangeMessage("Barvy úspěšně změněny!");
  };

  return (
    <div>
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
              onChange={handleDarkModeToggle}
              checked={darkMode === "dark"}
            />
            <label className="form-check-label" htmlFor="darkModeSwitch">
              {darkMode === "dark" ? "Zapnuto " : "Vypnuto"}
            </label>
          </div>
        </div>
        <div className="border border-primary rounded px-3 py-3">
          <h2>Změna barev</h2>
          <h4 className="bg-primary rounded px-2 py-1">Primární</h4>
          <input
            type="color"
            onChange={(e) => setNewColor("--bs-primary", e.target.value)}
            value={colorsList["--bs-primary"]?.hexColor || "#007bff"}
            className="input-group input-group-sm mb-3"
          />
          <h4 className="bg-secondary rounded px-2 py-1">Sekundární</h4>
          <input
            type="color"
            onChange={(e) => setNewColor("--bs-secondary", e.target.value)}
            value={colorsList["--bs-secondary"]?.hexColor || "#6c757d"}
            className="input-group input-group-sm mb-3"
          />
          <h4 className="bg-success rounded px-2 py-1">Úspěšně</h4>
          <input
            type="color"
            onChange={(e) => setNewColor("--bs-success", e.target.value)}
            value={colorsList["--bs-success"]?.hexColor || "#28a745"}
            className="input-group input-group-sm mb-3"
          />
          <h4 className="bg-danger rounded px-2 py-1">Chyba</h4>
          <input
            type="color"
            onChange={(e) => setNewColor("--bs-danger", e.target.value)}
            value={colorsList["--bs-danger"]?.hexColor || "#dc3545"}
            className="input-group input-group-sm mb-3"
          />
          <h4 className="bg-warning rounded px-2 py-1">Varování</h4>
          <input
            type="color"
            onChange={(e) => setNewColor("--bs-warning", e.target.value)}
            value={colorsList["--bs-warning"]?.hexColor || "#ffc107"}
            className="input-group input-group-sm mb-3"
          />
          <button onClick={handleSaveColors} className="btn btn-primary">
            Uložit barvy
          </button>
          {colorChangeMessage && (
            <div className="mt-3 alert alert-info">{colorChangeMessage}</div>
          )}
        </div>
      </div>
      <h1 className="text-primary font-weight-bold mb-0 mt-4">Bezpečnost</h1>
      <hr className="mb-4" />
      <div className="border border-primary rounded px-3 py-3 mb-3">
        <h2>Odhlásit ze všech relací</h2>
        <button
          className="btn btn-primary w-100 mb-2"
          onClick={handleSaveColors}
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

function Expenses({ activeModule, name }: ModuleProps) {
  // todo redefine delete
  const [days, setDays] = useState<Date[]>([]);
  const [calendarData, setCalendarData] = useState<any[]>(() => {
    const savedData = localStorage.getItem(`moduleData-${activeModule}`);
    return savedData ? JSON.parse(savedData) : [];
  });
  const [newExpense, setNewExpense] = useState(0);
  const [newIssuer, setNewIssuer] = useState("X");
  const [newCategory, setNewCategory] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedExpenses, setSelectedExpenses] = useState<number[]>([]);
  const [selectedIssuers, setSelectedIssuers] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [allIssuers, setAllIssuers] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allExpenses, setAllExpenses] = useState(new Map<string, number[]>());
  useEffect(() => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    );
    const startPaddingDays = (firstDayOfMonth.getDay() + 6) % 7;
    const generatedDays: Date[] = [];

    for (let i = 0; i < startPaddingDays; i++) {
      generatedDays.push(new Date(0));
    }

    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      generatedDays.push(new Date(today.getFullYear(), today.getMonth(), day));
    }

    setDays(generatedDays);
  }, []);

  const isToday = (date: Date) => {
    if (date.getTime() === 0) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const handleModal = (day: Date) => {
    const dayKey = day.toISOString().split("T")[0];
    setSelectedDay(dayKey);
    const existingEntry = calendarData.find((entry) => entry.id === dayKey);
    setSelectedExpenses(existingEntry?.text || []);
    setSelectedIssuers(existingEntry?.issuers || []);
    setSelectedCategories(existingEntry?.categories || []);
    const modal = document.getElementById("expModal");
    if (modal) modal.style.display = "block";
  };

  const handleAddExpense = () => {
    if (newExpense === 0 || newIssuer === "X") {
      alert("Expense can't be zero nor Issuer!");
      return;
    }
    selectedExpenses.push(newExpense);
    selectedIssuers.push(newIssuer);
    selectedCategories.push(newCategory);
    if (selectedDay) {
      const updatedData = calendarData.filter(
        (entry) => entry.id !== selectedDay
      );
      updatedData.push({
        id: selectedDay,
        text: selectedExpenses,
        issuers: selectedIssuers,
        categories: selectedCategories,
        edit: true,
      });
      setCalendarData(updatedData);
      localStorage.setItem(
        `moduleData-${activeModule}`,
        JSON.stringify(updatedData)
      );
    }
  };

  const handleDeleteExpense = (index: number) => {
    if (selectedDay) {
      setSelectedExpenses((prevExpenses) => {
        const updatedExpenses = prevExpenses.filter(
          (_, temp) => temp !== index
        );
        setSelectedIssuers((prevIssuers) => {
          const updatedIssuers = prevIssuers.filter(
            (_, temp) => temp !== index
          );
          setSelectedCategories((prevCategories) => {
            const updatedCategories = prevCategories.filter(
              (_, temp) => temp !== index
            );
            setCalendarData((prevData) => {
              const updatedData = prevData.filter(
                (entry) => entry.id !== selectedDay
              );
              updatedData.push({
                id: selectedDay,
                text: updatedExpenses,
                issuers: updatedIssuers,
                categories: updatedCategories,
                edit: true,
              });
              setCalendarData(updatedData);
              localStorage.setItem(
                `moduleData-${activeModule}`,
                JSON.stringify(updatedData)
              );
              return updatedData;
            });
            return updatedCategories;
          });
          return updatedIssuers;
        });
        return updatedExpenses;
      });
    }
  };

  useEffect(() => {
    let tempCategories = [
      ...new Set(calendarData.flatMap((item) => item.categories)),
    ];
    let tempIssuers = [
      ...new Set(calendarData.flatMap((item) => item.issuers)),
    ];
    let tempExpenses = new Map<string, number[]>();
    tempCategories.forEach((category) => {
      tempExpenses.set(category, new Array(tempIssuers.length).fill(0));
    });
    for (let i = 0; i < calendarData.length; i++) {
      for (let j = 0; j < calendarData[i].text.length; j++) {
        for (let k = 0; k < tempIssuers.length; k++) {
          if (tempIssuers[k] === calendarData[i].issuers[j]) {
            let tempArray = tempExpenses.get(calendarData[i].categories[j]);
            if (tempArray) {
              tempArray[k] += calendarData[i].text[j];
              tempExpenses.set(calendarData[i].categories[j], tempArray);
            }
          }
        }
      }
    }
    setAllCategories(tempCategories);
    setAllIssuers(tempIssuers);
    setAllExpenses(tempExpenses);
  }, [calendarData]);

  return (
    <div className="container my-4">
      <h2 className="text-center mb-4">{name} 💸</h2>

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
            onClick={() => handleModal(day)}
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
                  {(() => {
                    const entry = calendarData.find(
                      (entry) => entry.id === day.toISOString().split("T")[0]
                    );

                    if (entry) {
                      const sum = entry.text.reduce(
                        (total: number, num: number) =>
                          total + (Number(num) || 0),
                        0
                      );

                      return <strong className="fs-4">{sum}</strong>;
                    }
                  })()}
                </div>
              </>
            )}
          </button>
        ))}
      </div>
      <table className="table mt-5">
        <thead>
          <tr>
            <th scope="col">Kategorie</th>
            {allIssuers.map((issuer, index) => (
              <th scope="col" key={index}>
                {issuer}
              </th>
            ))}
            <th scope="col">Suma</th>
          </tr>
        </thead>
        <tbody>
          {allCategories.map((category) => {
            const categoryExpenses =
              allExpenses.get(category) ?? new Array(allIssuers.length).fill(0);
            const categorySum = categoryExpenses.reduce(
              (sum, value) => sum + value,
              0
            );

            return (
              <tr key={category}>
                <td scope="row">
                  <strong>{category}</strong>
                </td>
                {categoryExpenses.map((value, issuerIndex) => (
                  <td key={issuerIndex}>{value}</td>
                ))}
                <td>
                  <strong>{categorySum}</strong>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div
        id="expModal"
        className="modal"
        style={{ display: "none", position: "fixed" }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">Přidej výdaj</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() =>
                  (document.getElementById("expModal")!.style.display = "none")
                }
              ></button>
            </div>
            <div className="modal-body bg-light">
              <div className="d-flex flex-wrap gap-3">
                <ul className="list-group list-group-flush bg-light">
                  {selectedExpenses.map((expense, index) => (
                    <li
                      key={index}
                      className="d-flex list-group-item bg-light justify-content-between"
                      style={{
                        backgroundColor: "transparent",
                        color: "inherit",
                      }}
                    >
                      {selectedCategories[index]}
                      <span style={{ marginLeft: "30px" }}>
                        {selectedIssuers[index]}
                      </span>
                      <span style={{ marginLeft: "30px" }}>{expense} Kč</span>
                      <button
                        className="btn btn-sm btn-warning"
                        style={{ marginLeft: "30px" }}
                        onClick={() => handleDeleteExpense(index)}
                      >
                        Zamést stopy 🕵️
                      </button>
                    </li>
                  ))}
                  <hr />
                  <p>
                    <strong>Celkově:</strong>{" "}
                    {selectedExpenses.reduce(
                      (sum, expense) => sum + expense,
                      0
                    )}{" "}
                    Kč
                  </p>
                </ul>
                <input
                  type="number"
                  id="newExpense"
                  className="form-control"
                  value={newExpense}
                  onChange={(e) => setNewExpense(parseInt(e.target.value, 10))}
                />
                <select
                  className="form-select"
                  onChange={(e) => setNewIssuer(e.target.value)}
                >
                  <option value="X">Kdo utratil tolik peněz</option>
                  <option value="A">Anička</option>
                  <option value="P">Pepíček</option>
                </select>
                <input
                  type="text"
                  id="newCategory"
                  className="form-control"
                  placeholder="a ještě k tomu za co?!"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer bg-light">
              <button className="btn btn-primary" onClick={handleAddExpense}>
                Uložit nový výdaj
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  (document.getElementById("expModal")!.style.display = "none")
                }
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Movie {
  id: string;
  text: string;
  season: number;
  episode: number;
  banner: string; 
  url: string;
  edit: boolean;
}

function Watchlist({ activeModule, name }: ModuleProps) {
  // modal, "did you see the episode?"
  // implicit episode++
  // if 404, next season
  const [selectedMovie, setSelectedMovie] = useState(0);
  const [watchList, setWatchList] = useState<any[]>(() => {
    const savedData = localStorage.getItem(`moduleData-${activeModule}`);
    return savedData ? JSON.parse(savedData) : [];
  });
  const [newMovie, setNewMovie] = useState({id: 0, text: "", url: "", banner: "", season: 0, episode: 0, edit: true})
  const [increment, setIncrement] = useState(1);
  const handleModal = (modalName: string, movieId?: number) => {
    const modal = document.getElementById(`${modalName}Modal`);
    if (modal) modal.style.display = "block";
    if (modalName === "watch" && movieId) {
      let entry = (watchList.find((entry) => entry.id === movieId));
      setSelectedMovie(entry.id);
      if (entry.url) {
        let newUrl = entry.url.replace(/\^SEASON\^/g, String(entry.season).padStart(2, "0"));
        newUrl = newUrl.replace(/\^EPISODE\^/g, String(entry.episode).padStart(2, "0"));
        window.open(newUrl, "_blank", "noopener,noreferrer");
      } else {
        alert("chyba v url");
      }
    }
  };
  const handleCloseModal = (modalName: string) => {
    const modal = document.getElementById(`${modalName}Modal`);
    if (modal) modal.style.display = "none";
  }

  const handleChangeForm = (e: any) => {
    const { name, value } = e.target;
    setNewMovie((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  }

  const handleAddMovie = () => {
    let tempNewMovie = newMovie;
    tempNewMovie.id = Date.now(); 
    const updatedWatchList = [...watchList, tempNewMovie];
    setWatchList(updatedWatchList);
    localStorage.setItem(
      `moduleData-${activeModule}`,
      JSON.stringify(updatedWatchList)
    );
    setNewMovie({text: "", url: "", banner: "", season: 0, episode: 0, edit: true, id: 0});
    handleCloseModal("add");
  }

  const handleRemoveMovie = () => {
    const updatedData = watchList.filter(
      (entry) => entry.id !== selectedMovie
    );
    updatedData.push({
      id: selectedMovie,
      text: "",
      edit: true,
    });
    setWatchList(updatedData);
    localStorage.setItem(
      `moduleData-${activeModule}`,
      JSON.stringify(updatedData)
    );
  }

  return (
    <div className="container" style={{width: "100%", height: "100%"}}>
      <title>Centrum\{name}</title>
      <div className="d-flex flex-wrap gap-3 p-3">
      {watchList.map((movie) => (
        <div
          key={movie.id}
          className="card shadow-sm border-0 rounded-3 my-4 mx-1"
          style={{
            width: "30%",
            height: "70%",
            cursor: "pointer",
            transition: "transform 0.2s",
          }}
          onClick={() => handleModal("watch", movie.id)}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.01)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <div className="overflow-hidden" style={{ width: "100%", height: "100%" }}>
          <img
            src={movie.banner}
            className="card-img-top h-100 w-100"
            style={{ objectFit: "cover"}}
          />
          </div>
          <div className="card-body text-center bg-primary">
            <p className="card-title text-white fs-5 fw-bold">{movie.text}</p>
            <p className="card-text text-white fs-4">{movie.season && movie.episode ? `s${movie.season}e${movie.episode}` : "🎬"}</p>
          </div>
        </div>
      ))}
      </div>
      <button
        onClick={() => handleModal("add")}
        className="btn btn-info mt-4 fs-5"
      >
        Přidat nový seriál/film na <strong>WatchList</strong>
      </button>
      {/* Modal to watch*/}
      <div
        id="watchModal"
        className="modal"
        style={{ display: "none", position: "fixed", boxShadow: "0 5px 15px rgba(0,0,0,.5)"}}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">Did you watch the episode?</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => handleCloseModal("watch")}
              ></button>
            </div>
            <div className="modal-body bg-light">
              <input
                type="number"
                id="increment"
                className="form-control"
                value={increment}
                onChange={(e) => setIncrement(parseInt(e.target.value, 10))}
              />
              <button
                className="btn btn-danger mt-3 fs-5"
              >
                Season++
              </button>
              <button
                className="btn btn-warning mt-3 fs-5"
                style={{
                  marginLeft: "50%"
                }}
              >
                Episode++
              </button>
              
            </div>
            <div className="modal-footer bg-light">
              <button
                className="btn btn-primary"
                onClick={() => {handleCloseModal("watch");handleModal("change");}}
              >
               Změnit nastavení 
              </button>
              <button
                className="btn btn-secondary"
                style={{
                  marginLeft: "50%"
                }}
                onClick={() => handleCloseModal("watch")}
              >
                Storno
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Modal to add */}
      <div
        id="addModal"
        className="modal"
        style={{ display: "none", position: "fixed" }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">Přidej novou odrážku na seznam</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => handleCloseModal("add")}
              ></button>
            </div>
            <div className="modal-body bg-light">
              <form>
                <input
                  type="text"
                  name="text"
                  className="form-control mt-2"
                  placeholder="Název filmu/seriálu"
                  value={newMovie.text}
                  onChange={handleChangeForm}
                />
                <input
                  type="text"
                  name="banner"
                  className="form-control mt-2"
                  placeholder="Odkaz na plakát"
                  value={newMovie.banner}
                  onChange={handleChangeForm}
                />
                <input
                  type="text"
                  name="url"
                  className="form-control mt-2"
                  placeholder="Odkaz na 👀 stránku"
                  value={newMovie.url}
                  onChange={handleChangeForm}
                />
                <p className="badge text-danger"><small>Tam, kde jsou čísla epizod a sérií, dosaď ^EPISODE^ a ^SEASON^</small></p>
                <div className="row">
                  <div className="col">
                  <label>Season</label>
                    <input
                      type="number"
                      name="season"
                      className="form-control"
                      value={newMovie.season}
                      onChange={handleChangeForm}
                    />
                  </div>
                  <div className="col">
                    <label>Episode</label>
                    <input
                      type="number"
                      name="episode"
                      className="form-control"
                      value={newMovie.episode}
                      onChange={handleChangeForm}
                    />
                  </div>
                  <p className="badge text-secondary"><small>Když se Episode a Season rovná nule, znamená to, že se jedná o <strong>FILM</strong></small></p>
                </div>
                </form>
            </div>
            <div className="modal-footer bg-light">
              <button
                className="btn btn-primary"
                style={{
                  marginLeft: "50%"
                }}
                onClick={handleAddMovie}
              >
                Přidat  
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleCloseModal("add")}
              >
                Storno
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Modal to change */}
      <div
        id="changeModal"
        className="modal"
        style={{ display: "none", position: "fixed" }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">To Watch</h5>
            </div>
            <div className="modal-body bg-light">
            <button
                className="btn btn-danger"
                style={{width: "100%"}}
                onClick={() => handleRemoveMovie()}
              >
                Smazat z watchlistu
              </button>
            </div>
            <div className="modal-footer bg-light">
              <button
                className="btn btn-secondary"
                onClick={() => handleCloseModal("change")}
              >
                Storno
              </button>
            </div>
          </div>
        </div>
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
        <img src="home.gif" />
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
              <ToDo name="Anička" activeModule={activeModule} />
            </div>
            <div style={{ flex: 1, textAlign: "center", padding: "2%" }}>
              <ToDo name="Pepíček" activeModule={activeModule} />
            </div>
          </div>
        ) : null}
        {activeModule === 2 ? (
          <Notes name="Poznámky" activeModule={activeModule} />
        ) : null}
        {activeModule === 3 ? (
          <Calendar name="Kalendář" activeModule={activeModule} />
        ) : null}
        {activeModule === 4 ? (
          <Tales name="Pohádky" activeModule={activeModule} />
        ) : null}
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
              <Points name="Anička" activeModule={activeModule} />
            </div>
            <div
              style={{
                flex: 1,
                textAlign: "center",
                padding: "2%",
                paddingLeft: "2%",
              }}
            >
              <Points name="Pepíček" activeModule={activeModule} />
            </div>
          </div>
        ) : null}
        {activeModule === 6 ? (
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
              <ToDo name="Domácnost 🏠" activeModule={activeModule} />
            </div>
            <div
              style={{
                flex: 1,
                borderRight: "1px solid silver",
                textAlign: "center",
                padding: "2%",
              }}
            >
              <ToDo name="Hygiena 🧼" activeModule={activeModule} />
            </div>
            <div
              style={{
                flex: 1,
                textAlign: "center",
                padding: "2%",
              }}
            >
              <ToDo name="Lednička ❄️" activeModule={activeModule} />
            </div>
          </div>
        ) : null}
        {activeModule === 7 ? (
          <Expenses name="Expenses" activeModule={activeModule} />
        ) : null}
        {activeModule === 8 ? (
          <Watchlist name="Watchlist" activeModule={activeModule} />
        ) : null}
        {activeModule === 9 ? <Settings /> : null}
      </div>
    </div>
  );
}
export default Dashboard;
