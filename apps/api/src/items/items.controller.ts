import { Controller, Get, Inject, Query } from "@nestjs/common";
import { CurrentPlayerId } from "../common/decorators/current-player-id.decorator";
import { ListItemsDto } from "./dto/list-items.dto";
import { ItemsService } from "./items.service";

@Controller("v1/items")
export class ItemsController {
  private readonly itemsService: ItemsService;

  constructor(@Inject(ItemsService) itemsService: ItemsService) {
    this.itemsService = itemsService;
  }

  @Get()
  async list(
    @Query() query: ListItemsDto,
    @CurrentPlayerId() playerId: string
  ) {
    return this.itemsService.listItems(query.companyId, playerId);
  }
}
