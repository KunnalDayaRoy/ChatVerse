import ChatVerseApp from "./chat-verse/ChatVerseApp";

export default function App() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0a0b10" }}>
      <ChatVerseApp onClose={() => console.log("Closed")} />
    </div>
  );
}
