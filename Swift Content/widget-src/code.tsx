const { widget } = figma
const { useSyncedState, usePropertyMenu, useEffect, useWidgetNodeId, waitForTask, AutoLayout, Text, Input, SVG } = widget

interface ContentItem {
  id: string
  label: string
  text: string
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

function Widget() {
  const [items, setItems] = useSyncedState<ContentItem[]>('items', [
    { id: '1', label: '', text: '' },
  ])
  const [locale,      setLocale]      = useSyncedState('locale', 'de-ch')
  const [sujet,       setSujet]       = useSyncedState('sujet', 'Sujet')
  const [widgetWidth, setWidgetWidth] = useSyncedState('widgetWidth', 800)
  const [editingEnabled, setEditingEnabled] = useSyncedState('editingEnabled', false)
  const [isTranslating, setIsTranslating] = useSyncedState('isTranslating', false)
  const [status, setStatus] = useSyncedState('status', 'pending')
  const widgetNodeId = useWidgetNodeId()

  usePropertyMenu(
    [
      {
        itemType: 'dropdown',
        propertyName: 'status',
        tooltip: 'Status',
        selectedOption: status,
        options: [
          { option: 'pending', label: 'Pending' },
          { option: 'approved', label: 'Approved' },
        ],
      },
      {
        itemType: 'dropdown',
        propertyName: 'locale',
        tooltip: 'Locale',
        selectedOption: locale,
        options: [
          { option: 'de-ch', label: 'de-ch' },
          { option: 'fr-ch', label: 'fr-ch' },
          { option: 'it-ch', label: 'it-ch' },
          { option: 'en-ch', label: 'en-ch' },
        ],
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
        propertyName: 'copyContent',
        tooltip: 'Copy Content',
      },
      {
        itemType: 'action',
        propertyName: 'resetApiKey',
        tooltip: 'Reset Claude API Key',
      },
      {
        itemType: 'action',
        propertyName: 'duplicate',
        tooltip: '+ New Swift Content',
      },
    ],
    ({ propertyName, propertyValue }) => {
      if (propertyName === 'status' && propertyValue) {
        setStatus(propertyValue)
        return
      }
      if (propertyName === 'locale' && propertyValue) {
        setLocale(propertyValue)
        return
      }
      if (propertyName === 'width'  && propertyValue) {
        setWidgetWidth(Number(propertyValue))
        return
      }
      if (propertyName === 'copyContent') {
        return copyAllContent()
      }
      if (propertyName === 'resetApiKey') {
        return new Promise<void>((resolve) => {
          figma.clientStorage.setAsync('ai_claude_api_key', '').then(() => {
            console.log('Claude API key cleared. Click Translate to enter a new key.')
            resolve()
          })
        })
      }
      if (propertyName === 'duplicate') {
        return new Promise<void>((resolve) => {
          figma.getNodeByIdAsync(widgetNodeId).then(node => {
            if (node && node.type === 'WIDGET') {
              const clone = node.cloneWidget({
                items: [
                  { id: '1', label: '', text: '' },
                ],
                sujet: 'Sujet',
                locale: locale,
                widgetWidth: widgetWidth,
              })
              clone.x = node.x + node.width + 40
              clone.y = node.y
            }
            resolve()
          })
        })
      }
    }
  )

  useEffect(() => {
    figma.getNodeByIdAsync(widgetNodeId).then(node => {
      if (node && node.type === 'WIDGET') {
        node.setSharedPluginData('swift', 'content', JSON.stringify(
          items.map(i => ({ label: i.label || 'label', text: i.text }))
        ))
        node.setSharedPluginData('swift', 'sujet', sujet)
        node.setSharedPluginData('swift', 'locale', locale)
      }
    })
  })

  const plain = (val: string) => val.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()

  const syncToPlugin = (newItems: ContentItem[]) => {
    figma.getNodeByIdAsync(widgetNodeId).then(node => {
      if (node && node.type === 'WIDGET') {
        node.setSharedPluginData('swift', 'content', JSON.stringify(
          newItems.map(i => ({ label: i.label || 'label', text: i.text }))
        ))
      }
    })
  }

  const updateItemText  = (id: string, val: string) => {
    const newItems = items.map(i => i.id === id ? { ...i, text: plain(val) }  : i)
    setItems(newItems)
    syncToPlugin(newItems)
  }
  const updateItemLabel = (id: string, val: string) => {
    const newItems = items.map(i => i.id === id ? { ...i, label: plain(val) } : i)
    setItems(newItems)
    syncToPlugin(newItems)
  }
  const deleteItem = (id: string) => {
    const newItems = items.filter(i => i.id !== id)
    setItems(newItems)
    syncToPlugin(newItems)
  }
  const addItem = () => {
    const newItems = [...items, { id: Date.now().toString(), label: '', text: '' }]
    setItems(newItems)
    syncToPlugin(newItems)
    setEditingEnabled(true)
  }

  const copyAllContent = () => {
    return new Promise<void>((resolve) => {
      const parts = [locale]
      
      if (sujet) {
        parts.push(sujet)
      }
      
      items.forEach(item => {
        if (item.label) {
          parts.push('')
          parts.push(item.label)
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
      `, { visible: true, width: 300, height: 280 })
      
      figma.ui.onmessage = (msg) => {
        if (msg.type === 'close') {
          figma.ui.close()
          figma.notify('Copied to clipboard')
          resolve()
        }
      }
    })
  }

  const translateContent = () => {
    return waitForTask((async () => {
      try {
        // Get API key and model from client storage (shared with plugin)
        let apiKey = await figma.clientStorage.getAsync('ai_claude_api_key')
        let model = await figma.clientStorage.getAsync('ai_selected_model')
        
        // Fallback to default model if not set
        if (!model) {
          model = 'claude-sonnet-4-20250514'
        }
        
        if (!apiKey) {
          // Prompt user for API key
          apiKey = await new Promise<string>((resolve) => {
            figma.showUI(`
              <style>
                body { 
                  font-family: Inter, sans-serif; 
                  padding: 16px; 
                  margin: 0;
                  background: #1E1E1E;
                  color: #FFFFFF;
                  overflow: hidden;
                }
                h3 { 
                  margin: 0 0 12px 0; 
                  font-size: 14px; 
                  font-weight: 600;
                  color: #FFFFFF;
                }
                input { 
                  width: 100%; 
                  padding: 8px 10px; 
                  margin: 0 0 12px 0; 
                  border: 1px solid #333333; 
                  border-radius: 4px;
                  background: #2C2C2C;
                  color: #FFFFFF;
                  font-family: Inter, sans-serif;
                  font-size: 13px;
                  box-sizing: border-box;
                }
                input::placeholder {
                  color: #999999;
                }
                input:focus {
                  outline: none;
                  border-color: #18A0FB;
                }
                button { 
                  background: #18A0FB; 
                  color: white; 
                  border: none; 
                  padding: 8px 16px; 
                  border-radius: 4px; 
                  cursor: pointer;
                  font-family: Inter, sans-serif;
                  font-size: 13px;
                  font-weight: 500;
                  width: 100%;
                }
                button:hover { 
                  background: #1E90FF; 
                }
              </style>
              <h3>Enter Claude API Key</h3>
              <input type="password" id="apiKey" placeholder="sk-ant-..." autofocus />
              <button onclick="parent.postMessage({pluginMessage: {type: 'api-key', key: document.getElementById('apiKey').value}}, '*')">Save</button>
            `, { width: 320, height: 130 })
            
            figma.ui.onmessage = (msg) => {
              if (msg.type === 'api-key') {
                figma.ui.close()
                resolve(msg.key)
              }
            }
          })
          
          if (!apiKey) {
            setIsTranslating(false)
            return
          }
          
          // Store API key in client storage for future use
          await figma.clientStorage.setAsync('ai_claude_api_key', apiKey)
        }
        
        setIsTranslating(true)
        
        // Translate each content item
        const translatedItems = []
        for (const item of items) {
          if (!item.text) {
            translatedItems.push(item)
            continue
          }
          
          // Call Claude API for translation
          // Map locale codes to language names
          const languageMap: { [key: string]: string } = {
            'de-ch': 'German',
            'fr-ch': 'French',
            'it-ch': 'Italian',
            'en-ch': 'English'
          }
          const targetLanguage = languageMap[locale] || locale
          
          const requestBody = {
            model: model,
            max_tokens: 1024,
            messages: [
              { 
                role: 'user', 
                content: `Translate the following text to ${targetLanguage}. Output ONLY the translated text, nothing else. Preserve formatting and tone.\n\n${item.text}` 
              }
            ]
          }
          
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify(requestBody)
          })
          
          if (response.status === 401) {
            // Invalid API key - clear it and stop
            await figma.clientStorage.setAsync('ai_claude_api_key', '')
            throw new Error('Invalid API key. Please click Translate again to enter a new key.')
          }
          
          if (response.ok) {
            const data = await response.json()
            const translatedText = data.content[0].text
            translatedItems.push({ ...item, text: translatedText })
          } else {
            const errorText = await response.text()
            console.error('Claude API error response:', errorText)
            throw new Error(`Translation failed (${response.status}): ${errorText}`)
          }
        }
        
        setItems(translatedItems)
        syncToPlugin(translatedItems)
        
      } catch (error) {
        console.error('Translation error:', error)
      }
      
      setIsTranslating(false)
    })())
  }

  return (
    <AutoLayout
      name="Swift Content"
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
        {/* Top row: translate button + status badge + locale (centered) + sujet (right-aligned) */}
        <AutoLayout spacing={8} verticalAlignItems="center" width="fill-parent">
          <AutoLayout
            fill={C.primary}
            cornerRadius={6}
            padding={{ vertical: 10, horizontal: 12 }}
            hoverStyle={{ fill: '#1E90FF' }}
            onClick={translateContent}
          >
            <Text
              fill={C.textPrimary}
              fontSize={27}
              fontWeight={700}
              fontFamily="Inter"
            >
              {isTranslating ? 'Translating...' : 'Translate'}
            </Text>
          </AutoLayout>
          <AutoLayout
            fill={status === 'approved' ? C.success : '#E53935'}
            cornerRadius={6}
            padding={{ vertical: 10, horizontal: 12 }}
            hoverStyle={{ fill: status === 'approved' ? '#45A049' : '#C62828' }}
            onClick={() => setStatus(status === 'approved' ? 'pending' : 'approved')}
          >
            <Text
              fill={C.textPrimary}
              fontSize={27}
              fontWeight={700}
              fontFamily="Inter"
            >
              {status === 'approved' ? 'Approved' : 'Pending'}
            </Text>
          </AutoLayout>
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
                horizontalAlignText="right"
                width="fill-parent"
                inputFrameProps={{ fill: C.bgTertiary }}
              />
            ) : (
              <Text
                fill={sujet ? C.textPrimary : C.textTertiary}
                fontSize={40}
                fontWeight={500}
                fontFamily="Inter"
                horizontalAlignText="right"
                width="fill-parent"
              >
                {sujet || 'Sujet'}
              </Text>
            )}
          </AutoLayout>
          <AutoLayout
            fill={C.warning}
            cornerRadius={6}
            padding={{ vertical: 6, horizontal: 12 }}
          >
            <Text
              fill={C.textPrimary}
              fontSize={32}
              fontWeight={700}
              fontFamily="Inter"
            >
              {locale}
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
            name={`Row-${item.label}`}
            fill={C.bgPrimary}
            width="fill-parent"
            padding={{ top: 10, bottom: 14, left: 16, right: 12 }}
            spacing={4}
            direction="vertical"
            cornerRadius={6}
            hoverStyle={{ fill: '#333333' }}
          >
            {/* Top row: label + delete */}
            <AutoLayout width="fill-parent" spacing={0} verticalAlignItems="center">
              {editingEnabled ? (
                <Input
                  value={item.label}
                  placeholder="Label"
                  onTextEditEnd={(e) => updateItemLabel(item.id, e.characters)}
                  fontWeight={700}
                  fontSize={22}
                  fontFamily="Inter"
                  width="fill-parent"
                  fill={item.label ? C.textTertiary : C.textDisabled}
                  inputFrameProps={{ fill: C.bgPrimary }}
                />
              ) : (
                <Text
                  fontWeight={700}
                  fontSize={22}
                  fontFamily="Inter"
                  width="fill-parent"
                  fill={item.label ? C.textTertiary : C.textDisabled}
                >
                  {item.label || 'Label'}
                </Text>
              )}
              <AutoLayout
                cornerRadius={6}
                padding={6}
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
                placeholder="Content"
                onTextEditEnd={(e) => updateItemText(item.id, e.characters)}
                fontSize={32}
                fontFamily="Inter"
                width="fill-parent"
                fill={item.text ? C.textPrimary : C.textDisabled}
                inputFrameProps={{ fill: C.bgPrimary }}
              />
            ) : (
              <Text
                fontSize={32}
                fontFamily="Inter"
                width="fill-parent"
                fill={item.text ? C.textPrimary : C.textDisabled}
              >
                {item.text || 'Content'}
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
              + Add content
            </Text>
          </AutoLayout>
        </AutoLayout>
      </AutoLayout>
    </AutoLayout>
  )
}

widget.register(Widget)
