import { Controller, Get, Inject } from "@nestjs/common";
import { CurrentPlayerId } from "../common/decorators/current-player-id.decorator";
import { PlayersService } from "./players.service";

@Controller("v1/players")
export class PlayersController {
  private readonly playersService: PlayersService;

  constructor(@Inject(PlayersService) playersService: PlayersService) {
    this.playersService = playersService;
  }

  @Get("me")
  async me(@CurrentPlayerId() playerId: string) {
    return this.playersService.getCurrentPlayer(playerId);
  }

  @Get("me/companies")
  async myCompanies(@CurrentPlayerId() playerId: string) {
    return this.playersService.listCurrentPlayerCompanies(playerId);
  }

  @Get("registry")
  async registry() {
    return this.playersService.listPlayerRegistry();
  }
}
