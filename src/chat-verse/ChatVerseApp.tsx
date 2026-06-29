import { useState, useEffect, useRef } from "react";
import { Send, LogOut, Download, Image, Users, MessageSquare, ArrowLeft, Trash, Radio } from "lucide-react";

interface Message {
  id: string;
  type: "chat" | "alert";
  sender: string;
  text: string;
  time: string;
  image?: string;
}

interface Member {
  name: string;
  status: "online";
}

interface ChatVerseAppProps {
  onClose?: () => void;
}

const PIESOCKET_API_KEY = "oCdGGZPqld7ihjZMDaURwZNSgIMa75j15ccjuISa"; // Public demo key

export default function ChatVerseApp({ onClose }: ChatVerseAppProps) {
  const [screen, setScreen] = useState<"lobby" | "chatroom">("lobby");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Chatroom states
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat feed to bottom
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup websocket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  // Handle joining or creating room
  const handleLobbyAction = (action: "join" | "create") => {
    if (!name.trim()) {
      setError("Please enter a username.");
      return;
    }

    if (action === "join" && !roomCode.trim()) {
      setError("Please enter a 4-letter room code.");
      return;
    }

    setError(null);
    let finalCode = roomCode.toUpperCase();

    if (action === "create") {
      // Generate a random 4-letter code
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      let code = "";
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      finalCode = code;
    } else {
      if (finalCode.length !== 4) {
        setError("Room code must be exactly 4 letters.");
        return;
      }
    }

    setRoomCode(finalCode);
    
    // Connect to WebSocket Server
    connectToWebSocket(name, finalCode);
  };

  // Connect to the live PieSocket WebSocket relay channel
  const connectToWebSocket = (username: string, code: string) => {
    const wsUrl = `wss://demo.piesocket.com/v3/${code}?api_key=${PIESOCKET_API_KEY}&notify_self=0`;
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setScreen("chatroom");
      const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      setMessages([
        {
          id: "system-init",
          type: "alert",
          sender: "System",
          text: `Welcome to Live ChatVerse Room #${code}!`,
          time: dateStr
        },
        {
          id: "system-join-self",
          type: "alert",
          sender: "System",
          text: `You have entered the room as ${username}`,
          time: dateStr
        }
      ]);

      setMembers([{ name: `${username} (You)`, status: "online" }]);

      // Broadcast join event to other peers
      const joinPacket = JSON.stringify({
        type: "join",
        sender: username,
        time: dateStr
      });
      socket.send(joinPacket);
    };

    socket.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        const time = packet.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (packet.sender === username) return; // Ignore messages from self if bounced back

        switch (packet.type) {
          case "join":
            // 1. Add alert
            setMessages(prev => [
              ...prev,
              {
                id: `alert-join-${Date.now()}`,
                type: "alert",
                sender: "System",
                text: `${packet.sender} has entered the room`,
                time
              }
            ]);
            // 2. Add to member list if not already present
            setMembers(prev => {
              if (prev.some(m => m.name === packet.sender)) return prev;
              return [...prev, { name: packet.sender, status: "online" }];
            });
            // 3. Reply with presence so they register us
            const presenceReply = JSON.stringify({
              type: "presence_reply",
              sender: username,
              time
            });
            socket.send(presenceReply);
            break;

          case "presence_reply":
            setMembers(prev => {
              if (prev.some(m => m.name === packet.sender)) return prev;
              return [...prev, { name: packet.sender, status: "online" }];
            });
            break;

          case "leave":
            setMessages(prev => [
              ...prev,
              {
                id: `alert-leave-${Date.now()}`,
                type: "alert",
                sender: "System",
                text: `${packet.sender} has left the room`,
                time
              }
            ]);
            setMembers(prev => prev.filter(m => m.name !== packet.sender));
            break;

          case "chat":
            setMessages(prev => [
              ...prev,
              {
                id: `chat-msg-${Date.now()}`,
                type: "chat",
                sender: packet.sender,
                text: packet.text,
                time,
                image: packet.image
              }
            ]);
            break;
          
          default:
            break;
        }
      } catch (err) {
        console.error("Failed to parse incoming websocket packet", err);
      }
    };

    socket.onerror = () => {
      setError("Failed to connect to the live socket server. Please try again.");
      handleLeaveRoom();
    };

    socket.onclose = () => {
      // Revert screen if closed unexpectedly
      setScreen("lobby");
    };
  };

  // Handle sending a message
  const handleSendMessage = () => {
    if (!inputText.trim() && !selectedImage) return;
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // 1. Send via WebSocket
    const chatPacket = JSON.stringify({
      type: "chat",
      sender: name,
      text: inputText,
      time,
      image: selectedImage || undefined
    });
    socketRef.current.send(chatPacket);

    // 2. Add to messages locally immediately
    const userMsg: Message = {
      id: `user-msg-${Date.now()}`,
      type: "chat",
      sender: name,
      text: inputText,
      time,
      image: selectedImage || undefined
    };
    setMessages(prev => [...prev, userMsg]);

    // 3. Clear inputs
    setInputText("");
    setSelectedImage(null);
    setImageName(null);
  };

  // Export chat as text file
  const handleExportChat = () => {
    let exportText = `======================================\n`;
    exportText += `       CHATVERSE CONVERSATION LOG     \n`;
    exportText += `       Room Code: ${roomCode}         \n`;
    exportText += `       Export Date: ${new Date().toLocaleDateString()}\n`;
    exportText += `======================================\n\n`;

    messages.forEach(msg => {
      if (msg.type === "alert") {
        exportText += `[${msg.time}] --- SYSTEM: ${msg.text} ---\n`;
      } else {
        const imgTag = msg.image ? " [Image Attachment]" : "";
        exportText += `[${msg.time}] ${msg.sender}: ${msg.text}${imgTag}\n`;
      }
    });

    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chat_export_${roomCode}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handle image upload and read as data url
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Limit file size to 2MB to keep WebSocket payload size reasonable
      if (file.size > 2 * 1024 * 1024) {
        alert("Image size must be smaller than 2MB.");
        return;
      }

      setImageName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  const handleLeaveRoom = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const leavePacket = JSON.stringify({
        type: "leave",
        sender: name,
        time
      });
      socketRef.current.send(leavePacket);
      socketRef.current.close();
    }
    
    setScreen("lobby");
    setMessages([]);
    setMembers([]);
    setSelectedImage(null);
    setImageName(null);
  };

  return (
    <div className="chat-verse-root">
      {screen === "lobby" ? (
        <div className="lobby-container">
          <div className="lobby-card fade-in">
            {/* Top close trigger to return to portfolio */}
            {onClose && (
              <button 
                onClick={onClose}
                className="cv-btn cv-btn-secondary" 
                style={{
                  position: "absolute",
                  top: "16px",
                  left: "16px",
                  padding: "6px 12px",
                  fontSize: "11px",
                  borderRadius: "6px"
                }}
              >
                <ArrowLeft size={12} />
                <span>Back</span>
              </button>
            )}

            <div className="lobby-header" style={{ marginTop: "20px" }}>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "56px",
                height: "56px",
                borderRadius: "16px",
                background: "rgba(6, 182, 212, 0.1)",
                color: "var(--cv-color-cyan)",
                marginBottom: "16px"
              }}>
                <Radio size={28} className="animate-pulse" />
              </div>
              <h1>ChatVerse</h1>
              <p>Live WebSockets Group Chat Room</p>
            </div>

            <div className="lobby-form">
              <div className="input-group">
                <label>Enter Username</label>
                <input
                  type="text"
                  placeholder="Pick a handle..."
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={15}
                />
              </div>

              <div className="input-group">
                <label>Room Code (4-Letters)</label>
                <input
                  type="text"
                  placeholder="e.g. JOIN OR CREATE"
                  className="input-field"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={4}
                  style={{ textTransform: "uppercase", fontFamily: "var(--cv-font-mono)" }}
                />
              </div>

              {error && <div className="lobby-error">{error}</div>}

              <div className="lobby-buttons">
                <button 
                  onClick={() => handleLobbyAction("join")}
                  className="cv-btn cv-btn-secondary"
                >
                  Join Room
                </button>
                <button 
                  onClick={() => handleLobbyAction("create")}
                  className="cv-btn cv-btn-primary"
                  style={{ background: "linear-gradient(135deg, var(--cv-color-cyan) 0%, #0891b2 100%)" }}
                >
                  Create Room
                </button>
              </div>
            </div>

            <div style={{ marginTop: "32px", fontSize: "11px", color: "var(--cv-text-muted)", fontFamily: "var(--cv-font-mono)" }}>
              &copy; LIVE CHATVERSE CLIENT v1.1.0
            </div>
          </div>
        </div>
      ) : (
        <div className="chatroom-layout">
          {/* Chatroom Sidebar */}
          <div className="cv-sidebar">
            <div className="cv-sidebar-header">
              <div className="cv-sidebar-title" style={{ background: "linear-gradient(135deg, var(--cv-color-cyan) 0%, var(--cv-color-violet) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                ChatVerse
              </div>
              <div style={{ fontSize: "11px", color: "var(--cv-text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--cv-color-emerald)", display: "inline-block" }} />
                Live WebSocket
              </div>
              
              <div className="cv-room-badge">
                <span>Room Code:</span>
                <span>{roomCode}</span>
              </div>
            </div>

            {/* Members Section */}
            <div className="member-section">
              <h3 style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Users size={12} />
                <span>Room Members ({members.length})</span>
              </h3>
              <div className="member-list">
                {members.map((member) => (
                  <div key={member.name} className="member-item">
                    <div className="member-avatar">
                      {member.name.charAt(0)}
                    </div>
                    <div className="member-info">
                      <span className="member-name">{member.name}</span>
                      <span className="member-status">
                        <span className="status-dot online" />
                        online
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button onClick={handleExportChat} className="cv-btn cv-btn-secondary" style={{ width: "100%", padding: "10px" }}>
                <Download size={14} />
                <span>Export Chat</span>
              </button>
              <button onClick={handleLeaveRoom} className="cv-btn cv-btn-primary" style={{ width: "100%", padding: "10px", background: "linear-gradient(135deg, var(--cv-color-rose) 0%, #be123c 100%)" }}>
                <LogOut size={14} />
                <span>Leave Room</span>
              </button>
            </div>
          </div>

          <div className="cv-chat-window">
            <div className="cv-chat-header">
              <div className="cv-chat-title-info">
                <h2>Room #{roomCode}</h2>
                <span>Live sync active · Connect to share text and images</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={handleExportChat} className="cv-btn cv-btn-secondary" style={{ padding: "8px 12px", borderRadius: "8px", fontSize: "12px" }}>
                  <Download size={14} />
                  <span className="hidden sm:inline">Export</span>
                </button>
                <button onClick={handleLeaveRoom} className="cv-btn cv-btn-primary" style={{ padding: "8px 12px", borderRadius: "8px", fontSize: "12px", background: "var(--cv-color-rose)" }}>
                  <LogOut size={14} />
                  <span className="hidden sm:inline">Leave</span>
                </button>
              </div>
            </div>

            <div className="cv-feed" ref={feedRef}>
              {messages.length === 2 && (
                <div className="chat-alert" style={{ alignSelf: "center", border: "1px dashed var(--cv-color-cyan)" }}>
                  💡 Share this Room Code ({roomCode}) with a friend so they can join this room from their device and chat live!
                </div>
              )}
              {messages.map(msg =>
                msg.type === "alert" ? (
                  <div key={msg.id} className="chat-alert">{msg.text}</div>
                ) : (
                  <div key={msg.id} className={`message-wrapper ${msg.sender === name ? "user-msg" : "peer-msg"}`}>
                    <div className="msg-header">
                      <span className="msg-sender">{msg.sender === name ? "You" : msg.sender}</span>
                      <span className="msg-time">{msg.time}</span>
                    </div>
                    <div className="msg-bubble">
                      <div>{msg.text}</div>
                      {msg.image && (
                        <div className="msg-image">
                          <img src={msg.image} alt="Shared attachment" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="cv-chat-footer">
              {selectedImage && (
                <div className="image-preview-bar fade-in">
                  <img src={selectedImage} alt="Upload preview" className="preview-thumb" />
                  <div className="preview-info">
                    <strong>Image selected:</strong> {imageName || "attachment.png"}
                  </div>
                  <button
                    onClick={() => { setSelectedImage(null); setImageName(null); }}
                    className="cv-btn cv-btn-secondary"
                    style={{ padding: "4px 8px", borderRadius: "4px" }}
                  >
                    <Trash size={12} className="text-rose-500" />
                  </button>
                </div>
              )}
              <div className="input-bar-container">
                <input type="file" ref={fileInputRef} onChange={handleImageFileChange} accept="image/*" style={{ display: "none" }} />
                <button onClick={() => fileInputRef.current?.click()} className="icon-input-btn" title="Upload Image (Max 2MB)">
                  <Image size={18} />
                </button>
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="chat-input-field"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyPress}
                />
                <button onClick={handleSendMessage} className="cv-btn cv-btn-primary" style={{ height: "44px", width: "44px", padding: 0, background: "var(--cv-color-cyan)" }} title="Send Message">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
