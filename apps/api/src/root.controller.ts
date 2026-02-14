import { Controller, Get, Redirect } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

@AllowAnonymous()
@Controller()
export class RootController {
  @Get()
  @Redirect("/health", 302)
  redirectToHealth() {
    return;
  }
}
