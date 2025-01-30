import Tracker from "./components/Tracker.jsx";

function App() {
    return (
        <div style={{ margin: 0, padding: 0, width: "100vw", height: "100vh", overflow: "hidden" }}>
            <Tracker />
            <iframe
                id="geeApp"
                src="https://our-axon-435300-d4.projects.earthengine.app/view/agroclimate-v1"
                style={{
                    width: "100%",
                    height: "100vh",
                    border: "none",
                    display: "block"
                }}
                title="Agroclimate Viewer"
            />
        </div>
    );
}

export default App;
