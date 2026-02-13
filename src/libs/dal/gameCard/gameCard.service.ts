import { CRUDService } from "../../../base/crudService";
import { GameCardModel } from "./gameCard.model";
class GameCardService extends CRUDService(GameCardModel) {}

const gameCardService = new GameCardService();

export { gameCardService };
