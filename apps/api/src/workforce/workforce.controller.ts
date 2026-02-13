import { BadRequestException, Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { CurrentPlayerHandle } from "../common/decorators/current-player-handle.decorator";
import { GetCompanyWorkforceDto } from "./dto/get-company-workforce.dto";
import { RequestWorkforceCapacityChangeDto } from "./dto/request-workforce-capacity-change.dto";
import { SetWorkforceAllocationDto } from "./dto/set-workforce-allocation.dto";
import { WorkforceService } from "./workforce.service";

function assertAllocationSum(
  operationsPct: number,
  researchPct: number,
  logisticsPct: number,
  corporatePct: number
): void {
  const sum = operationsPct + researchPct + logisticsPct + corporatePct;
  if (sum !== 100) {
    throw new BadRequestException("allocation percentages must sum to 100");
  }
}

@Controller("v1/company/workforce")
export class WorkforceController {
  private readonly workforceService: WorkforceService;

  constructor(@Inject(WorkforceService) workforceService: WorkforceService) {
    this.workforceService = workforceService;
  }

  @Get()
  async getWorkforce(
    @Query() query: GetCompanyWorkforceDto,
    @CurrentPlayerHandle() playerHandle: string
  ) {
    return this.workforceService.getCompanyWorkforce(query.companyId, playerHandle);
  }

  @Post("allocation")
  async setAllocation(
    @Body() body: SetWorkforceAllocationDto,
    @CurrentPlayerHandle() playerHandle: string
  ) {
    assertAllocationSum(body.operationsPct, body.researchPct, body.logisticsPct, body.corporatePct);
    return this.workforceService.setAllocation(
      {
        companyId: body.companyId,
        operationsPct: body.operationsPct,
        researchPct: body.researchPct,
        logisticsPct: body.logisticsPct,
        corporatePct: body.corporatePct
      },
      playerHandle
    );
  }

  @Post("capacity-change")
  async requestCapacityChange(
    @Body() body: RequestWorkforceCapacityChangeDto,
    @CurrentPlayerHandle() playerHandle: string
  ) {
    return this.workforceService.requestCapacityChange(
      {
        companyId: body.companyId,
        deltaCapacity: body.deltaCapacity
      },
      playerHandle
    );
  }
}
