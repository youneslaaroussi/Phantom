import { useEffect, useState } from "react"
import "./style.css"

const Popup = () => {
  const [capturing, setCapturing] = useState(true)
  const [captureStatus, setCaptureStatus] = useState("")

  useEffect(() => {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id || tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) {
          setCapturing(false)
          return
        }
        const streamId = await chrome.tabCapture.getMediaStreamId({ consumerTabId: tab.id })
        await chrome.storage.local.set({
          pendingStreamId: streamId,
          pendingStreamTabId: tab.id,
          pendingStreamTs: Date.now(),
        })
        setCaptureStatus("Audio ready")
      } catch {
        setCaptureStatus("")
      } finally {
        setCapturing(false)
      }
    })()
  }, [])

  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error)
    }
    window.close()
  }

  return (
    <div style={{
      width: 280,
      padding: "20px",
      background: "var(--g-surface)",
      fontFamily: "var(--g-font-text)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "16px",
    }}>
      <div
        onClick={openSidePanel}
        style={{
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          padding: "8px",
          borderRadius: "var(--g-radius-md)",
          transition: "background 0.2s",
          width: "100%",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--g-surface-dim)" }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
      >
        <img
          src={chrome.runtime.getURL("assets/mascot.png")}
          alt="Phantom"
          style={{
            width: 180,
            height: 180,
            imageRendering: "pixelated" as const,
            filter: "drop-shadow(0 4px 16px rgba(66,133,244,0.25))",
            animation: "float 4s ease-in-out infinite",
          }}
        />
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "var(--g-font)",
            fontSize: 16,
            fontWeight: 600,
            color: "var(--g-on-surface)",
          }}>
            Phantom
          </div>
          <div style={{
            fontSize: 12,
            color: "var(--g-blue)",
            fontWeight: 500,
            marginTop: 4,
          }}>
            Click to get started
          </div>
        </div>
      </div>



      <div style={{
        display: "flex",
        gap: "16px",
        paddingTop: "4px",
        borderTop: "1px solid var(--g-outline-variant)",
        width: "100%",
        justifyContent: "center",
      }}>
        {[
          { label: "GitHub", url: "https://github.com/youneslaaroussi/Phantom" },
          { label: "Website", url: "https://phantom-server-pio3n3nsna-uc.a.run.app/" },
          { label: "Permissions", url: "" },
        ].map((link) => (
          <a
            key={link.label}
            href={link.url || "#"}
            onClick={(e) => {
              if (!link.url) {
                e.preventDefault()
                chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=chrome-extension://${chrome.runtime.id}` })
              }
            }}
            target={link.url ? "_blank" : undefined}
            rel={link.url ? "noopener noreferrer" : undefined}
            style={{
              fontSize: 11,
              color: "var(--g-outline)",
              textDecoration: "none",
              fontWeight: 500,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--g-blue)" }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--g-outline)" }}
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  )
}

export default Popup
