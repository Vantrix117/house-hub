// The park map's property box, shared by the Worker's readers of the family `loc:<id>` rows (batch 10, P3-DOLLYWOOD-LIVE-06).
// The mapped frame is 1535 x 2211 m (x east, y north, metres from the frame's south-west corner); the property (the map's PROPERTY polygon: the parks, parking lots and tram road, x -96..2470, y 36..3482) is held in the box below: the frame plus
// 300 m, widened to contain that whole polygon. The park map publishes a fix only from the property, so a row outside the box is an old fix from the house or
// the road: it never makes a "park day" (chat's where_is_family, parkJob's fresh grown-up) and Home's "At the park" ignores it
// (index.html parkOn()/offPark() are the same numbers). A row with no x/y is not judged here.
export const PARK_BOX = { x0: -300, x1: 2500, y0: -300, y1: 3510 };
export const parkOn = (x, y) => Number.isFinite(x) && Number.isFinite(y) && x >= PARK_BOX.x0 && x <= PARK_BOX.x1 && y >= PARK_BOX.y0 && y <= PARK_BOX.y1;
/** True when the loc row's value carries a position that lies outside the property. */
export const offProperty = v => !!v && typeof v === 'object' && v.x != null && v.y != null && Number.isFinite(+v.x) && Number.isFinite(+v.y) && !parkOn(+v.x, +v.y);
