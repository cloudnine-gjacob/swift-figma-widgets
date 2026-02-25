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
  const widgetNodeId = useWidgetNodeId()

  usePropertyMenu(
    [
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
      { itemType: 'separator' },
      {
        itemType: 'dropdown',
        propertyName: 'width',
        tooltip: 'Width',
        selectedOption: String(widgetWidth),
        options: [
          { option: '800', label: 'Small (800)' },
          { option: '1100', label: 'Medium (1100)' },
          { option: '1400', label: 'Large (1400)' },
          { option: '1800', label: 'Extra Large (1800)' },
        ],
      },
      { itemType: 'separator' },
      {
        itemType: 'action',
        propertyName: 'duplicate',
        tooltip: '+ New Swift Content',
      },
    ],
    ({ propertyName, propertyValue }) => {
      if (propertyName === 'locale' && propertyValue) {
        setLocale(propertyValue)
        return
      }
      if (propertyName === 'width'  && propertyValue) {
        setWidgetWidth(Number(propertyValue))
        return
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
        {/* Top row: locale badge + sujet (right-aligned) */}
        <AutoLayout spacing={8} verticalAlignItems="center" width="fill-parent">
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
