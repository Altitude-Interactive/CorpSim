import { Controller, Get, Redirect } from "@nestjs/common";

@Controller()
export class RootController {
  @Get()
  @Redirect("/health", 302)
  redirectToHealth() {
    return;
  }
}
