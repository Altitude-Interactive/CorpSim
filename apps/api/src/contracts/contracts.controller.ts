import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query
} from "@nestjs/common";
import { CurrentPlayerHandle } from "../common/decorators/current-player-handle.decorator";
import { ContractsService } from "./contracts.service";
import { AcceptContractDto } from "./dto/accept-contract.dto";
import { ContractParamDto } from "./dto/contract-param.dto";
import { FulfillContractDto } from "./dto/fulfill-contract.dto";
import { ListContractsDto } from "./dto/list-contracts.dto";

function parseLimit(raw: string | undefined): number {
  if (raw === undefined) {
    return 100;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
    throw new BadRequestException("limit must be an integer between 1 and 500");
  }

  return parsed;
}

@Controller("v1/contracts")
export class ContractsController {
  private readonly contractsService: ContractsService;

  constructor(@Inject(ContractsService) contractsService: ContractsService) {
    this.contractsService = contractsService;
  }

  @Get()
  async listContracts(
    @Query() query: ListContractsDto,
    @CurrentPlayerHandle() playerHandle: string
  ) {
    return this.contractsService.listContracts(
      {
        status: query.status,
        itemId: query.itemId,
        limit: parseLimit(query.limit)
      },
      playerHandle
    );
  }

  @Post(":id/accept")
  async acceptContract(
    @Param() params: ContractParamDto,
    @Body() body: AcceptContractDto,
    @CurrentPlayerHandle() playerHandle: string
  ) {
    return this.contractsService.acceptContract(params.id, body.sellerCompanyId, playerHandle);
  }

  @Post(":id/fulfill")
  @HttpCode(HttpStatus.OK)
  async fulfillContract(
    @Param() params: ContractParamDto,
    @Body() body: FulfillContractDto,
    @CurrentPlayerHandle() playerHandle: string
  ) {
    return this.contractsService.fulfillContract(
      params.id,
      body.sellerCompanyId,
      body.quantity,
      playerHandle
    );
  }
}
