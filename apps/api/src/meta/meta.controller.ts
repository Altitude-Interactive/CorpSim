import { Controller, Get } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { getAppVersion } from "../core/version";

@AllowAnonymous()
@Controller("meta")
export class MetaController {
  @Get("version")
  getVersion() {
    return {
      version: getAppVersion()
    };
  }
}
