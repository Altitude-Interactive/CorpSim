import { Controller, Get } from "@nestjs/common";
import { getAppVersion } from "../core/version";

@Controller("meta")
export class MetaController {
  @Get("version")
  getVersion() {
    return {
      version: getAppVersion()
    };
  }
}
