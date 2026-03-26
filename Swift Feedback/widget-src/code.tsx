const { widget } = figma
const { useSyncedState, usePropertyMenu, useEffect, useWidgetNodeId, waitForTask, AutoLayout, Text, Input, SVG } = widget

interface FeedbackItem {
  id: string
  username: string
  text: string
  timestamp: string
}

// --- Design Tokens (matching plugin) ---
const C = {
  primary:      '#18A0FB',
  success:      '#4CAF50',
  warning:      '#FFA500',
  bgPrimary:    '#2C2C2C',
  bgSecondary:  '#1E1E1E',
  bgTertiary:   '#1A1A1A',
  bgHover:      '#252525',
  bgDisabled:   '#3D3D3D',
  border:       '#3D3D3D',
  textPrimary:  '#FFFFFF',
  textSecondary:'#B3B3B3',
  textTertiary: '#999999',
  textDisabled: '#FFFFFF',
}

const CLOSE_SVG = `<svg width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4L4 12M4 4L12 12" stroke="#999999" stroke-width="2" stroke-linecap="round"/></svg>`

// --- Constants ---
const STATUS_COLORS: { [key: string]: { bg: string; hover: string } } = {
  pending: { bg: '#E53935', hover: '#C62828' },
  'in-progress': { bg: '#00BCD4', hover: '#00ACC1' },
  check: { bg: '#9C27B0', hover: '#8E24AA' },
  feedback: { bg: '#FF9800', hover: '#FB8C00' },
  approved: { bg: C.success, hover: '#45A049' }
}

// --- Utility Functions ---
const formatTimestamp = () => {
  const now = new Date()
  const pad = (n: number) => (n < 10 ? '0' + n : String(n))
  const day = pad(now.getDate())
  const month = pad(now.getMonth() + 1)
  const year = now.getFullYear()
  const hours = pad(now.getHours())
  const minutes = pad(now.getMinutes())
  return `${day}/${month}/${year}, ${hours}:${minutes}`
}

function Widget() {
  const [items, setItems] = useSyncedState<FeedbackItem[]>('items', [
    { id: '1', username: 'Anonymous', text: '', timestamp: formatTimestamp() },
  ])
  const [sujet, setSujet] = useSyncedState('sujet', 'Sujet')
  const [widgetWidth, setWidgetWidth] = useSyncedState('widgetWidth', 800)
  const [editingEnabled, setEditingEnabled] = useSyncedState('editingEnabled', false)
  const [status, setStatus] = useSyncedState('status', 'pending')

  // Initialize first item with current user if it's still Anonymous
  useEffect(() => {
    if (items.length === 1 && items[0].username === 'Anonymous' && figma.currentUser) {
      const newItems = [{ ...items[0], username: figma.currentUser.name }]
      setItems(newItems)
    }
  })

  const getDisplayTimestamp = (timestamp: string) => {
    if (!timestamp) return formatTimestamp()
    
    // If it contains AM/PM, parse and reformat
    if (timestamp.includes('AM') || timestamp.includes('PM')) {
      try {
        const date = new Date(timestamp)
        if (!isNaN(date.getTime())) {
          return date.toLocaleString('en-GB', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
          })
        }
      } catch (e) {
        return formatTimestamp()
      }
    }
    
    return timestamp
  }

  const [lastModified, setLastModified] = useSyncedState('lastModified', formatTimestamp())
  const widgetNodeId = useWidgetNodeId()

  const plain = (val: string) => val.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()

  // --- Property Menu Configuration ---
  usePropertyMenu(
    [
      {
        itemType: 'dropdown',
        propertyName: 'status',
        tooltip: 'Status',
        selectedOption: status,
        options: [
          { option: 'pending', label: 'Pending' },
          { option: 'in-progress', label: 'In Progress' },
          { option: 'check', label: 'Check' },
          { option: 'feedback', label: 'Feedback' },
          { option: 'approved', label: 'Approved' },
        ],
      },
      {
        itemType: 'action',
        propertyName: 'copyContent',
        tooltip: 'Copy',
      },
      {
        itemType: 'dropdown',
        propertyName: 'width',
        tooltip: 'Widget Width',
        selectedOption: String(widgetWidth),
        options: [
          { option: '600', label: '600px' },
          { option: '800', label: '800px' },
          { option: '1000', label: '1000px' },
          { option: '1100', label: '1100px' },
          { option: '1400', label: '1400px' },
          { option: '1800', label: '1800px' },
        ],
      },
      {
        itemType: 'action',
        propertyName: 'duplicate',
        tooltip: '+ New Swift Feedback',
      },
    ],
    ({ propertyName, propertyValue }) => {
      if (propertyName === 'status' && propertyValue) {
        setStatus(propertyValue)
        setLastModified(formatTimestamp())
        return
      }
      if (propertyName === 'width'  && propertyValue) {
        setWidgetWidth(Number(propertyValue))
        return
      }
      if (propertyName === 'copyContent') {
        return copyAllContent()
      }
      if (propertyName === 'duplicate') {
        return duplicateWidget()
      }
    }
  )

  // --- Feedback Management Functions ---
  const syncToPlugin = (newItems: FeedbackItem[]) => {
    figma.getNodeByIdAsync(widgetNodeId).then(node => {
      if (node && node.type === 'WIDGET') {
        node.setSharedPluginData('swift', 'feedback', JSON.stringify(
          newItems.map(i => ({ username: i.username, text: i.text, timestamp: i.timestamp }))
        ))
      }
    })
  }

  const updateItemText  = (id: string, val: string) => {
    const newItems = items.map(i => i.id === id ? { ...i, text: plain(val) }  : i)
    setItems(newItems)
    syncToPlugin(newItems)
    setLastModified(formatTimestamp())
  }
  const deleteItem = (id: string) => {
    const newItems = items.filter(i => i.id !== id)
    setItems(newItems)
    syncToPlugin(newItems)
    setLastModified(formatTimestamp())
  }
  const addItem = () => {
    const username = figma.currentUser?.name || 'Anonymous'
    const newItems = [...items, { 
      id: Date.now().toString(), 
      username: username, 
      text: '', 
      timestamp: formatTimestamp() 
    }]
    setItems(newItems)
    syncToPlugin(newItems)
    setStatus('feedback')
    setLastModified(formatTimestamp())
    setEditingEnabled(true)
  }

  // --- Dialog Functions ---

  const duplicateWidget = () => {
    return new Promise<void>((resolve) => {
      const username = figma.currentUser?.name || 'Anonymous'
      figma.getNodeByIdAsync(widgetNodeId).then(node => {
        if (node && node.type === 'WIDGET') {
          const clone = node.cloneWidget({
            items: [{ id: '1', username: username, text: '', timestamp: formatTimestamp() }],
            sujet: 'Sujet',
            widgetWidth: widgetWidth,
          })
          clone.x = node.x + node.width + 40
          clone.y = node.y
        }
        resolve()
      })
    })
  }



  const copyAllContent = () => {
    return new Promise<void>((resolve) => {
      const parts = []
      
      if (sujet) {
        parts.push(sujet)
      }
      
      items.forEach(item => {
        if (item.username) {
          parts.push('')
          parts.push(`${item.username} - ${item.timestamp}`)
        }
        if (item.text) {
          parts.push(item.text)
        }
      })
      
      const textToCopy = parts.join('\n')
      
      // Minimal UI with auto-focused button — user gesture needed for clipboard access
      const json = JSON.stringify(textToCopy)
      figma.showUI(`
        <style>
          body { margin:0; background:#2C2C2C; display:flex; flex-direction:column; height:100vh; padding:8px; box-sizing:border-box; font-family:Inter,sans-serif; }
          pre { flex:1; margin:0 0 8px 0; padding:8px; background:#1A1A1A; border-radius:6px; color:#B3B3B3; font:12px/1.5 monospace; overflow-y:auto; white-space:pre-wrap; word-break:break-word; }
          button { background:#18A0FB; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font:700 11px Inter,sans-serif; flex-shrink:0; }
          button:hover { background:#1E90FF; }
        </style>
        <pre id="preview"></pre>
        <button id="btn" autofocus>Copy to Clipboard</button>
        <script>
          var text = ${json};
          document.getElementById('preview').textContent = text;
          document.getElementById('btn').onclick = function() {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            parent.postMessage({pluginMessage: {type: 'close'}}, '*');
          };
        </script>
      `, { visible: true, width: 400, height: 400 })
      
      figma.ui.onmessage = (msg) => {
        if (msg.type === 'close') {
          figma.ui.close()
          figma.notify('Copied to clipboard')
          resolve()
        }
      }
    })
  }


  // --- Render ---
  return (
    <AutoLayout
      name="Swift Feedback"
      direction="vertical"
      width={widgetWidth}
      cornerRadius={8}
      fill={C.bgSecondary}
      padding={0}
      spacing={0}
    >
      {/* ── Header ── */}
      <AutoLayout
        name="Header"
        direction="vertical"
        fill={C.bgTertiary}
        width="fill-parent"
        padding={{ top: 20, bottom: 18, left: 24, right: 24 }}
        spacing={10}
        cornerRadius={{ topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 }}
      >
        {/* Top row: sujet name, last change, status */}
        <AutoLayout spacing={8} verticalAlignItems="center" width="fill-parent">
          <AutoLayout
            width="fill-parent"
            cornerRadius={6}
            padding={{ vertical: 4, horizontal: 8 }}
            hoverStyle={editingEnabled ? { fill: '#252525' } : undefined}
          >
            {editingEnabled ? (
              <Input
                value={sujet}
                placeholder="Sujet"
                onTextEditEnd={(e) => setSujet(e.characters)}
                fill={sujet ? C.textPrimary : C.textTertiary}
                fontSize={40}
                fontWeight={500}
                fontFamily="Inter"
                width="fill-parent"
                inputFrameProps={{ fill: C.bgTertiary }}
              />
            ) : (
              <Text
                fill={sujet ? C.textPrimary : C.textTertiary}
                fontSize={40}
                fontWeight={500}
                fontFamily="Inter"
                width="fill-parent"
              >
                {sujet || 'Sujet'}
              </Text>
            )}
          </AutoLayout>
          <AutoLayout
            padding={{ vertical: 10, horizontal: 12 }}
          >
            <Text
              fill={C.textSecondary}
              fontSize={22}
              fontWeight={500}
              fontFamily="Inter"
            >
              {getDisplayTimestamp(lastModified)}
            </Text>
          </AutoLayout>
          <AutoLayout
            fill={STATUS_COLORS[status].bg}
            cornerRadius={6}
            padding={{ vertical: 10, horizontal: 12 }}
            hoverStyle={{ fill: STATUS_COLORS[status].hover }}
            onClick={() => {
              const statuses = ['pending', 'in-progress', 'check', 'feedback', 'approved']
              const currentIndex = statuses.indexOf(status)
              const nextStatus = statuses[(currentIndex + 1) % statuses.length]
              setStatus(nextStatus)
              setLastModified(formatTimestamp())
            }}
          >
            <Text
              fill={C.textPrimary}
              fontSize={27}
              fontWeight={700}
              fontFamily="Inter"
            >
              {status === 'approved' ? 'Approved' : status === 'in-progress' ? 'In Progress' : status === 'check' ? 'Check' : status === 'feedback' ? 'Feedback' : 'Pending'}
            </Text>
          </AutoLayout>
        </AutoLayout>
      </AutoLayout>

      {/* ── Content Items ── */}
      <AutoLayout
        direction="vertical"
        width="fill-parent"
        padding={{ top: 12, bottom: 12, left: 16, right: 16 }}
        spacing={10}
        fill={C.bgSecondary}
      >
        {items.map((item) => (
          <AutoLayout
            key={item.id}
            name={`Row-${item.username}`}
            fill={C.bgPrimary}
            width="fill-parent"
            padding={{ top: 10, bottom: 14, left: 16, right: 12 }}
            spacing={4}
            direction="vertical"
            cornerRadius={6}
            hoverStyle={{ fill: '#333333' }}
          >
            {/* Top row: username + timestamp + delete */}
            <AutoLayout width="fill-parent" spacing={0} verticalAlignItems="center" height={36}>
              <AutoLayout spacing={10} verticalAlignItems="center">
                <Text
                  fontWeight={700}
                  fontSize={22}
                  fontFamily="Inter"
                  fill={C.textTertiary}
                >
                  {item.username}
                </Text>
                <Text
                  fontSize={18}
                  fontFamily="Inter"
                  fill={C.textSecondary}
                >
                  {item.timestamp}
                </Text>
              </AutoLayout>
              <AutoLayout width="fill-parent" />
              <AutoLayout
                cornerRadius={6}
                padding={4}
                verticalAlignItems="center"
                horizontalAlignItems="center"
                hoverStyle={{ fill: C.bgDisabled }}
                onClick={() => deleteItem(item.id)}
              >
                <SVG src={CLOSE_SVG} />
              </AutoLayout>
            </AutoLayout>

            {/* Text content */}
            {editingEnabled ? (
              <Input
                value={item.text}
                placeholder="Add your feedback..."
                onTextEditEnd={(e) => updateItemText(item.id, e.characters)}
                fontSize={28}
                fontFamily="Inter"
                width="fill-parent"
                fill={item.text ? C.textPrimary : C.textDisabled}
                inputFrameProps={{ fill: C.bgPrimary }}
              />
            ) : (
              <Text
                fontSize={28}
                fontFamily="Inter"
                lineHeight={36}
                width="fill-parent"
                fill={item.text ? C.textPrimary : C.textDisabled}
              >
                {item.text || 'Add your feedback...'}
              </Text>
            )}
          </AutoLayout>
        ))}

        {/* ── Buttons row ── */}
        <AutoLayout width="fill-parent" spacing={8}>
          <AutoLayout
            name="Edit"
            fill={C.primary}
            width="fill-parent"
            padding={{ vertical: 16, horizontal: 16 }}
            cornerRadius={6}
            horizontalAlignItems="center"
            verticalAlignItems="center"
            hoverStyle={{ fill: '#1E90FF' }}
            onClick={() => setEditingEnabled(!editingEnabled)}
          >
            <Text fill={C.textPrimary} fontSize={25} fontWeight={700} fontFamily="Inter">
              {editingEnabled ? 'Done' : 'Edit'}
            </Text>
          </AutoLayout>
          <AutoLayout
            name="Copy"
            fill={'#666666'}
            width="fill-parent"
            padding={{ vertical: 16, horizontal: 16 }}
            cornerRadius={6}
            horizontalAlignItems="center"
            verticalAlignItems="center"
            hoverStyle={{ fill: '#777777' }}
            onClick={copyAllContent}
          >
            <Text fill={C.textPrimary} fontSize={25} fontWeight={700} fontFamily="Inter">
              Copy
            </Text>
          </AutoLayout>
          <AutoLayout
            name="Add"
            fill={C.success}
            width="fill-parent"
            padding={{ vertical: 16, horizontal: 16 }}
            cornerRadius={6}
            horizontalAlignItems="center"
            verticalAlignItems="center"
            hoverStyle={{ fill: '#45A049' }}
            onClick={addItem}
          >
            <Text fill={C.textPrimary} fontSize={25} fontWeight={700} fontFamily="Inter">
              + Add Feedback
            </Text>
          </AutoLayout>
        </AutoLayout>
      </AutoLayout>
    </AutoLayout>
  )
}

widget.register(Widget)
