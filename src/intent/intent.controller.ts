import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query, Req,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtGuard } from "@core/guards/jwt.guard";
import { IntentService } from "./intent.service";
import { IntentDto } from "@core/dto/intent.dto";
import { plainToInstance } from "class-transformer";
import { Intent } from "@core/entities/intent.entity";
import { UpdateResult } from "typeorm/query-builder/result/UpdateResult";
import { PaginationQueryDto } from "@core/dto/pagination-query.dto";
import { Pagination } from "nestjs-typeorm-paginate";
import { IntentFilterDto } from "@core/dto/intent-filter.dto";
import { IntentModel } from "@core/models/intent.model";
import { IntentStatus } from "@core/enums/intent-status.enum";
import camelcaseKeys = require("camelcase-keys");
import snakecaseKeys = require("snakecase-keys");

@ApiTags('intent')
@Controller('intent')
@ApiBearerAuth()
@UseGuards(JwtGuard)
export class IntentController {
  constructor(private readonly _intentService: IntentService) {
  }

  @Get('')
  @ApiOperation({summary: 'Return all intents'})
  async getIntents(): Promise<IntentDto[]> {
    const intents: Intent[] = await this._intentService.findFullIntents();
    return plainToInstance(IntentDto, camelcaseKeys(intents, {deep: true}));
  }

  @Get(':intentId')
  @ApiOperation({summary: 'Return specific intent'})
  async getIntent(@Param('intentId') intentId: string): Promise<IntentDto> {
    const intent: Intent = await this._intentService.findOne(intentId);
    return plainToInstance(IntentDto, camelcaseKeys(intent, {deep: true}));
  }

  @Get('check/:intentId')
  @ApiOperation({summary: 'Check if id exists'})
  async checkIntentId(@Param('intentId') intentId: string): Promise<boolean> {
    return this._intentService.intentExists(intentId);
  }

  @Post('search')
  @ApiOperation({summary: 'Return intents paginated'})
  async getIntentsPagination(@Query() options: PaginationQueryDto,
                             @Body() filters: IntentFilterDto): Promise<IntentDto[]> {
    const intents: Pagination<IntentModel> = await this._intentService.paginate(options, filters);
    intents.items.filter(i => !!i).map(i => plainToInstance(IntentDto, camelcaseKeys(i, {deep: true})));
    // @ts-ignore
    return camelcaseKeys(intents, {deep: true});
  }

  @Post('')
  @ApiOperation({summary: 'Create an intent'})
  async createEditIntent(@Body() intentDto: IntentDto,
                         @Req() req): Promise<IntentDto> {
    let intent = this._formatIntent(intentDto);
    intent.user = req.user;
    intent.status = IntentStatus.to_deploy;
    if (await this._intentService.intentExists(intent.id)) {
      throw new HttpException(`Impossible de créer cette connaissance, l'identifiant existe déjà.`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    intent = await this._intentService.createEdit(intent, null);
    return plainToInstance(IntentDto, camelcaseKeys(intent, {deep: true}));
  }

  @Put(':id')
  @ApiOperation({summary: 'Edit an intent'})
  async editIntent(@Param('id') intentId: string,
                   @Body() intentDto: IntentDto): Promise<IntentDto> {
    let intent = this._formatIntent(intentDto);
    intent = await this._intentService.createEdit(intent, intent.id != intentId ? intentId : null);
    return plainToInstance(IntentDto, camelcaseKeys(intent, {deep: true}));
  }

  @Delete(':intentId')
  @ApiOperation({summary: 'Archive an intent'})
  async deleteIntent(@Param('intentId') intentId: string): Promise<UpdateResult> {
    return this._intentService.delete(intentId);
  }

  @Post('tree')
  @ApiOperation({summary: 'Return full intent tree'})
  async getIntentsTree(@Query() options: PaginationQueryDto,
                       @Body() filters: IntentFilterDto): Promise<IntentDto[]> {
    const intents: Intent[] = await this._intentService.getFullTree(options, filters);
    return plainToInstance(IntentDto, camelcaseKeys(intents, {deep: true}));
  }

  private _formatIntent(intentDto: IntentDto): Intent {
    let intent: Intent = plainToInstance(Intent, snakecaseKeys(intentDto));
    if (intent.responses.findIndex(r => !r.id) >= 0) {
      intent.responses.map(r => {
        delete r.id;
      });
    }
    intent.responses.map(r => {
      r.intent = <Intent>{id: intent.id};
    });
    if (intent.knowledges) {
      intent.knowledges = intent.knowledges.filter(k => !!k.question.trim());
      intent.knowledges.map(k => {
        k.intent = <Intent>{id: intent.id};
        if (!k.id) {
          delete k.id;
        }
      });
      // Filter several knowledges with same questions
      intent.knowledges = intent.knowledges.reverse().filter((value, index, self) => {
        return self.findIndex(k => k.question === value.question) === index;
      });
    }
    return intent;
  }
}
