import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { CurrentPlayerId } from "../common/decorators/current-player-id.decorator";
import { CompleteOnboardingDto } from "./dto/complete-onboarding.dto";
import { OnboardingService } from "./onboarding.service";

@Controller("v1/onboarding")
export class OnboardingController {
  private readonly onboardingService: OnboardingService;

  constructor(@Inject(OnboardingService) onboardingService: OnboardingService) {
    this.onboardingService = onboardingService;
  }

  @Get("status")
  async status(@CurrentPlayerId() playerId: string) {
    return this.onboardingService.getStatus(playerId);
  }

  @Post("complete")
  async complete(
    @CurrentPlayerId() playerId: string,
    @Body() body: CompleteOnboardingDto
  ) {
    return this.onboardingService.complete({
      playerId,
      companyName: body.companyName,
      regionId: body.regionId
    });
  }
}

