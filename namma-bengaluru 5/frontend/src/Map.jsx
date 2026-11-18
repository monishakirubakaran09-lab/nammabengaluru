import { useEffect, useRef, useState } from 'react'
import { Crosshair, Minus, Plus } from 'lucide-react'

const WIDTH = 800
const HEIGHT = 445
const lakes = [
  [[98, 94], [126, 91], [144, 112], [128, 136], [97, 143], [81, 124]],
  [[291, 213], [307, 194], [342, 192], [368, 213], [348, 235], [318, 229]],
  [[576, 350], [603, 332], [628, 343], [643, 370], [627, 389], [588, 380]],
  [[539, 77], [555, 65], [576, 71], [577, 91], [553, 104], [528, 95]],
  [[698, 278], [727, 268], [742, 280], [736, 302], [707, 321], [695, 307]],
]
const parks = [
  [[0, 347], [67, 337], [113, 365], [96, 419], [0, 422]],
  [[193, 218], [224, 202], [274, 217], [266, 262], [216, 263]],
  [[376, 26], [452, 18], [495, 45], [464, 75], [407, 70]],
  [[700, 348], [754, 333], [804, 359], [800, 422], [742, 408]],
]
const largeStreets = [
  [[-20, 176], [85, 173], [183, 141], [243, 155], [364, 128], [420, 119], [500, 90], [636, 84], [806, 90]],
  [[-12, 311], [67, 295], [140, 270], [222, 281], [317, 290], [400, 273], [513, 243], [620, 235], [807, 229]],
  [[17, -10], [53, 92], [83, 171], [105, 254], [89, 362], [103, 454]],
  [[211, -14], [197, 64], [208, 137], [172, 185], [166, 236], [144, 268], [157, 300], [145, 388], [165, 452]],
  [[316, -10], [325, 83], [304, 153], [281, 235], [295, 340], [274, 450]],
  [[448, -12], [432, 70], [420, 119], [446, 226], [478, 280], [508, 324], [480, 450]],
  [[662, -10], [648, 77], [669, 132], [689, 174], [664, 216], [620, 278], [650, 347], [658, 456]],
  [[-12, 398], [90, 383], [193, 395], [274, 382], [401, 387], [521, 401], [652, 415], [807, 393]],
]
// Context streets are schematic and carry no traffic data.
const localStreets = [
  [[-30, 49], [39, 56], [89, 39], [151, 49], [199, 64], [252, 69], [327, 65]],
  [[-18, 121], [66, 126], [87, 109], [111, 70], [140, 35], [153, -16]],
  [[6, 219], [111, 209], [164, 204], [235, 188], [307, 187], [371, 167], [438, 165]],
  [[68, 172], [73, 241], [58, 286], [64, 338], [53, 389], [57, 444]],
  [[137, 150], [132, 199], [128, 231], [134, 255], [131, 283], [122, 330]],
  [[-16, 271], [58, 261], [113, 254], [167, 248], [193, 259], [219, 278]],
  [[19, 350], [87, 356], [145, 348], [192, 349], [241, 369], [291, 376]],
  [[190, 301], [201, 334], [186, 365], [190, 394], [213, 436]],
  [[221, 98], [245, 121], [252, 159], [266, 185], [253, 211], [274, 248], [281, 275]],
  [[265, 304], [278, 273], [316, 259], [363, 252], [395, 222], [434, 212]],
  [[293, 33], [342, 46], [365, 79], [380, 133], [386, 179], [394, 219], [403, 275]],
  [[355, 290], [372, 315], [364, 350], [355, 393], [362, 437]],
  [[321, 362], [385, 359], [439, 368], [504, 367], [553, 382]],
  [[401, -12], [405, 52], [394, 100], [388, 120]],
  [[477, 87], [488, 129], [506, 161], [499, 209], [515, 244], [552, 267], [571, 307]],
  [[446, 192], [493, 180], [553, 184], [605, 196], [662, 207], [732, 198], [820, 172]],
  [[467, 225], [486, 218], [507, 211], [555, 229], [577, 269], [596, 286]],
  [[530, 22], [551, 36], [569, 71], [602, 108], [605, 139], [600, 163]],
  [[567, 6], [610, 27], [666, 36], [729, 29], [817, 47]],
  [[591, 74], [627, 110], [647, 159], [626, 203], [617, 235], [627, 258]],
  [[705, 35], [720, 84], [742, 134], [751, 175], [744, 229], [761, 272], [777, 308]],
  [[505, 293], [547, 319], [601, 312], [651, 315], [699, 329], [752, 321], [803, 333]],
  [[525, 407], [538, 361], [552, 326], [564, 290]],
  [[656, 365], [694, 367], [724, 394], [784, 413]],
]

const labels = {
  indiranagar: [0, 22, 'center'],
  baiyappanahalli: [-8, -16, 'center'],
  'old-airport': [0, 22, 'center'],
  'kr-puram': [0, -17, 'center'],
  marathahalli: [4, 24, 'center'],
  hoodi: [0, 23, 'center'],
  whitefield: [0, -17, 'center'],
}

function paintMap(canvas, viewport, data, journey, selected, zoom) {
  const { width, height } = viewport
  const pixelRatio = window.devicePixelRatio || 1
  canvas.width = Math.round(width * pixelRatio)
  canvas.height = Math.round(height * pixelRatio)
  const ctx = canvas.getContext('2d')
  ctx.scale(pixelRatio, pixelRatio)
  ctx.fillStyle = '#efeee7'
  ctx.fillRect(0, 0, width, height)
  const scale = Math.min(width / WIDTH, height / HEIGHT) * zoom
  const offsetX = (width - WIDTH * scale) / 2
  const offsetY = (height - HEIGHT * scale) / 2
  ctx.translate(offsetX, offsetY)
  ctx.scale(scale, scale)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  function path(points, color, lineWidth, fill = false) {
    ctx.beginPath()
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    if (fill) {
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
    } else {
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.stroke()
    }
  }

  parks.forEach(points => path(points, '#dce7d7', 0, true))
  localStreets.forEach(points => path(points, '#faf9f5', 2.1))
  lakes.forEach(points => {
    path(points, '#cddfe5', 0, true)
    path([...points, points[0]], '#b6cfd7', 1)
  })
  largeStreets.forEach(points => {
    path(points, '#d8d7cc', 4.3)
    path(points, '#fffcf6', 2.7)
  })
  ctx.font = '500 10px system-ui'
  ctx.fillStyle = '#59645b'
  ctx.textAlign = 'center'
  ctx.fillText('CV Raman Nagar', 258, 276)
  ctx.fillText('Mahadevapura', 514, 203)
  ctx.fillText('Brookefield', 686, 351)
  ctx.fillText('Domlur', 93, 341)
  ctx.fillText('B Narayanapura', 396, 206)
  ctx.fillText('Doddanekundi', 478, 308)

  const coordinates = id => [data.junctions[id].x, data.junctions[id].y]
  const roadPoints = road => [coordinates(road.from), ...road.bends, coordinates(road.to)]
  const selectedRoads = new Set(selected.links)
  const alternateRoads = new Set(data.routes[0].links)
  const disrupted = []
  for (const [id, road] of Object.entries(data.roads)) {
    const points = roadPoints(road)
    path(points, '#fbfaf6', 8)
    path(points, '#9da59a', 3)
    if (road.delay) disrupted.push(points)
    if (!road.delay && alternateRoads.has(id)) path(points, '#4779a6', 3)
  }
  for (const [id, road] of Object.entries(data.roads)) {
    if (selectedRoads.has(id) && !road.delay) {
      path(roadPoints(road), '#fbfaf6', 8.5)
      path(roadPoints(road), '#286451', 5.5)
    }
  }
  if (selected.mode === 'Metro') {
    const metroPoints = selected.nodes.map(coordinates).map(([x, y]) => [x, y - 10])
    ctx.setLineDash([8, 5])
    path(metroPoints, '#71559a', 4)
    ctx.setLineDash([])
  }
  for (const points of disrupted) {
    path(points, '#fff8ed', 8)
    path(points, '#b44131', 4.5)
    const [x, y] = points[2]
    ctx.fillStyle = '#b44131'
    ctx.beginPath()
    ctx.arc(x, y, 9.5, 0, 2 * Math.PI)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = '800 12px system-ui'
    ctx.fillText('!', x, y + 4)
  }
  const markers = []
  for (const [id, junction] of Object.entries(data.junctions)) {
    const [x, y] = coordinates(id)
    const endpoint = id === journey.origin || id === journey.destination
    const affected = Boolean(data.signals[id].diversion)
    ctx.beginPath()
    ctx.arc(x, y, endpoint ? 8 : 5.5, 0, 2 * Math.PI)
    ctx.fillStyle = endpoint ? '#286451' : '#fff'
    ctx.fill()
    ctx.strokeStyle = affected ? '#b44131' : endpoint ? '#fff' : '#647569'
    ctx.lineWidth = 1.65
    ctx.stroke()
    if (endpoint) {
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, 2 * Math.PI)
      ctx.fillStyle = '#fff'
      ctx.fill()
    }
    const [dx, dy, align] = labels[id] || [0, -12, 'center']
    ctx.textAlign = align
    ctx.font = `600 ${Math.max(10, Math.min(16, 10 / scale))}px system-ui`
    ctx.lineWidth = 4
    ctx.strokeStyle = '#f8f7f1'
    ctx.strokeText(junction.name, x + dx, y + dy)
    ctx.fillStyle = endpoint ? '#1a4739' : '#27362d'
    ctx.fillText(junction.name, x + dx, y + dy)
    markers.push({ id, x: x * scale + offsetX, y: y * scale + offsetY })
  }
  return markers.filter(({ x, y }) => x >= 0 && x <= width && y >= 0 && y <= height)
}

export default function Map({ data, journey, selected, onJunction }) {
  const element = useRef(null)
  const canvas = useRef(null)
  const [viewport, setViewport] = useState(null)
  const [markers, setMarkers] = useState([])
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setViewport(entry.contentRect))
    observer.observe(element.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (viewport?.width && viewport?.height) {
      setMarkers(paintMap(canvas.current, viewport, data, journey, selected, zoom))
    }
  }, [data, journey, selected, viewport, zoom])

  return <div className="map-canvas" ref={element}>
    <canvas ref={canvas} aria-label="Schematic map of the simulated east Bengaluru corridor" role="img" />
    {markers.map(marker => <button type="button" key={marker.id} className="map-point"
      style={{ left: marker.x, top: marker.y }}
      title={data.junctions[marker.id].name} aria-label={`Inspect ${data.junctions[marker.id].name} signal`}
      onClick={() => onJunction(marker.id)} />)}
    <div className="map-tools">
      <button type="button" title="Zoom in" aria-label="Zoom in" disabled={zoom >= 1.75} onClick={() => setZoom(value => value + .25)}><Plus size={17} /></button>
      <button type="button" title="Zoom out" aria-label="Zoom out" disabled={zoom <= .75} onClick={() => setZoom(value => value - .25)}><Minus size={17} /></button>
      <button type="button" title="Reset zoom" aria-label="Reset zoom" onClick={() => setZoom(1)}><Crosshair size={15} /></button>
    </div>
  </div>
}
