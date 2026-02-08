import { Controller, Get, Inject } from "@nestjs/common";
import { ItemsService } from "./items.service";

@Controller("v1/items")
export class ItemsController {
  private readonly itemsService: ItemsService;

  constructor(@Inject(ItemsService) itemsService: ItemsService) {
    this.itemsService = itemsService;
  }

  @Get()
  async list() {
    return this.itemsService.listItems();
  }
}
