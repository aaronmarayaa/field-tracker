import { tripDistance, tripPace, tripTime, type Trip, type RoutePoint } from './trip';

export function posterRoute(points: RoutePoint[]): RoutePoint[] {
  const valid = points.filter((point) => point && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180);
  let previous = valid[0]?.longitude ?? 0;
  return valid.map((point) => {
    let longitude = point.longitude;
    while (longitude - previous > 180) longitude -= 360;
    while (longitude - previous < -180) longitude += 360;
    previous = longitude;
    const latitude = Math.max(-85, Math.min(85, point.latitude));
    return { longitude, latitude: Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)) * 180 / Math.PI };
  });
}

export async function drawTripPoster(canvas: HTMLCanvasElement, trip: Trip, background: string): Promise<void> {
  const image = new Image();
  image.src = background;
  await image.decode();
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This device could not create the trip image.');
  canvas.width = 1080;
  canvas.height = 1440;
  const scale = Math.max(1080 / image.naturalWidth, 1440 / image.naturalHeight);
  context.drawImage(image, (1080 - image.naturalWidth * scale) / 2, (1440 - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
  const shade = context.createLinearGradient(0, 0, 0, 1440);
  shade.addColorStop(0, 'rgba(0,0,0,.22)');
  shade.addColorStop(.45, 'rgba(0,0,0,.30)');
  shade.addColorStop(.65, 'rgba(0,0,0,.84)');
  shade.addColorStop(1, 'rgba(0,0,0,.88)');
  context.fillStyle = shade;
  context.fillRect(0, 0, 1080, 1440);

  const points = posterRoute(trip.route);
  if (points.length) {
    let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
    for (const point of points) {
      west = Math.min(west, point.longitude); east = Math.max(east, point.longitude);
      south = Math.min(south, point.latitude); north = Math.max(north, point.latitude);
    }
    const routeScale = Math.min(720 / (east - west || .0001), 580 / (north - south || .0001));
    const x = (longitude: number) => 540 + (longitude - (west + east) / 2) * routeScale;
    const y = (latitude: number) => 400 - (latitude - (south + north) / 2) * routeScale;
    context.beginPath();
    points.forEach((point, index) => index ? context.lineTo(x(point.longitude), y(point.latitude)) : context.moveTo(x(point.longitude), y(point.latitude)));
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#171917';
    context.lineWidth = 19;
    context.stroke();
    context.strokeStyle = '#ff8057';
    context.lineWidth = 12;
    context.stroke();
    if (east === west && north === south) {
      context.beginPath(); context.arc(540, 400, 9, 0, Math.PI * 2); context.fillStyle = '#ff8057'; context.fill();
    }
  }

  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.font = '86px Impact, Arial Narrow, sans-serif';
  context.fillText('FIELD TRACKER', 540, 900, 930);
  const values = [tripDistance(trip) + ' ' + trip.unit, tripPace(trip) + ' /' + trip.unit, tripTime(trip)];
  ['Distance', 'Pace', 'Time'].forEach((label, index) => {
    const x = 210 + index * 330;
    context.font = '40px Segoe UI, sans-serif';
    context.fillText(label, x, 1010);
    context.font = '700 58px Segoe UI, sans-serif';
    context.fillText(values[index], x, 1080, 305);
  });
  context.font = '26px Segoe UI, sans-serif';
  context.fillStyle = '#ffffff';
  context.fillText(new Date(trip.started_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }), 540, 1350);
}
