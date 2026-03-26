const { widget } = figma
const { useSyncedState, usePropertyMenu, useEffect, AutoLayout, Text, Input, SVG } = widget

const C = {
  primary:       '#18A0FB',
  success:       '#4CAF50',
  bgPrimary:     '#2C2C2C',
  bgSecondary:   '#1E1E1E',
  bgTertiary:    '#1A1A1A',
  border:        '#3D3D3D',
  textPrimary:   '#FFFFFF',
  textSecondary: '#B3B3B3',
  textTertiary:  '#999999',
}

const LINK_SVG = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M11.5 3H17V8.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M8.5 11.5L17 3" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M15 11.5V15.5C15 16.0523 14.5523 16.5 14 16.5H4.5C3.94772 16.5 3.5 16.0523 3.5 15.5V6C3.5 5.44772 3.94772 5 4.5 5H8.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

function Widget() {
  const [url, setUrl] = useSyncedState('url', 'https://')
  const [label, setLabel] = useSyncedState('label', 'Swift Build Link')
  const [widgetWidth, setWidgetWidth] = useSyncedState('widgetWidth', 800)

  useEffect(() => {
    figma.ui.onmessage = (msg) => {
      if (msg.type === 'close') {
        figma.closePlugin()
      }
    }
  })

  usePropertyMenu(
    [
      {
        itemType: 'dropdown',
        propertyName: 'width',
        tooltip: 'Widget Width',
        selectedOption: String(widgetWidth),
        options: [
          { option: '600',  label: '600px' },
          { option: '800',  label: '800px' },
          { option: '1000', label: '1000px' },
          { option: '1400', label: '1400px' },
        ],
      },
    ],
    ({ propertyName, propertyValue }) => {
      if (propertyName === 'width' && propertyValue) {
        setWidgetWidth(Number(propertyValue))
      }
    }
  )

  const openUrl = () =>
    new Promise<void>(() => {
      figma.openExternal(url)
    })

  return (
    <AutoLayout
      name="Swift Build Link"
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
        <Text
          fill={C.textPrimary}
          fontSize={40}
          fontWeight={500}
          fontFamily="Inter"
          width="fill-parent"
          horizontalAlignText="left"
        >
          {label}
        </Text>
      </AutoLayout>

      {/* ── URL Row ── */}
      <AutoLayout
        direction="vertical"
        width="fill-parent"
        padding={{ top: 12, bottom: 12, left: 16, right: 16 }}
        spacing={10}
        fill={C.bgSecondary}
      >
        <AutoLayout
          name="URL Row"
          fill={C.bgPrimary}
          width="fill-parent"
          padding={{ top: 10, bottom: 14, left: 16, right: 12 }}
          spacing={4}
          direction="vertical"
          cornerRadius={6}
        >
          <Input
            value={url}
            onTextEditEnd={(e) => setUrl(e.characters)}
            placeholder="url"
            fontSize={32}
            fontFamily="Inter"
            width="fill-parent"
            fill={url && url !== 'https://' ? C.textPrimary : C.textSecondary}
            inputFrameProps={{ fill: C.bgPrimary }}
          />
        </AutoLayout>

        {/* ── Open Button ── */}
        <AutoLayout
          name="Open Button"
          fill={C.primary}
          width="fill-parent"
          padding={{ vertical: 16, horizontal: 16 }}
          cornerRadius={6}
          horizontalAlignItems="center"
          verticalAlignItems="center"
          spacing={8}
          hoverStyle={{ fill: '#1E90FF' }}
          onClick={openUrl}
        >
          <Text fill={C.textPrimary} fontSize={25} fontWeight={700} fontFamily="Inter">
            Open Link
          </Text>
        </AutoLayout>
      </AutoLayout>
    </AutoLayout>
  )
}

widget.register(Widget)
