import { Controller, Get, Inject } from "@nestjs/common";
import { CurrentPlayerHandle } from "../common/decorators/current-player-handle.decorator";
import { PlayersService } from "./players.service";

@Controller("v1/players")
export class PlayersController {
  private readonly playersService: PlayersService;

  constructor(@Inject(PlayersService) playersService: PlayersService) {
    this.playersService = playersService;
  }

  @Get("me")
  async me(@CurrentPlayerHandle() playerHandle: string) {
    return this.playersService.getCurrentPlayer(playerHandle);
  }

  @Get("me/companies")
  async myCompanies(@CurrentPlayerHandle() playerHandle: string) {
    return this.playersService.listCurrentPlayerCompanies(playerHandle);
  }

  @Get("registry")
  async registry() {
    return this.playersService.listPlayerRegistry();
  }
}
