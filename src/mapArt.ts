import type { MapId } from "./gameData";

import ancientArt from "./assets/maps/ancient.jpg";
import anubisArt from "./assets/maps/anubis.jpg";
import dust2Art from "./assets/maps/dust2.jpg";
import infernoArt from "./assets/maps/inferno.jpg";
import mirageArt from "./assets/maps/mirage.png";
import nukeArt from "./assets/maps/nuke.jpg";
import trainArt from "./assets/maps/train.jpg";

export const mapArtImages: Record<MapId, string> = {
  mirage: mirageArt,
  inferno: infernoArt,
  nuke: nukeArt,
  ancient: ancientArt,
  anubis: anubisArt,
  dust2: dust2Art,
  train: trainArt,
};
