import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ChatbotConfigService } from "../chatbot-config/chatbot-config.service";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ChatbotConfig } from "@core/entities/chatbot-config.entity";
import { plainToInstance } from "class-transformer";
import camelcaseKeys = require("camelcase-keys");
import { PublicConfigDto } from "@core/dto/public-config.dto";
import { IntentDto } from "@core/dto/intent.dto";
import { IntentService } from "../intent/intent.service";
import { Intent } from "@core/entities/intent.entity";
import { FeedbackDto } from "@core/dto/feedback.dto";
import { FeedbackService } from "../feedback/feedback.service";
import snakecaseKeys = require("snakecase-keys/index");
import { Feedback } from "@core/entities/feedback.entity";
import { FaqService } from "../faq/faq.service";

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(private readonly _configService: ChatbotConfigService,
              private readonly _intentService: IntentService,
              private readonly _faqService: FaqService,
              private readonly _feedbackService: FeedbackService) {
  }

  @Get('')
  @ApiOperation({summary: 'Retourne les données publiques de la configuration du Chatbot'})
  async getChabotConfig(): Promise<PublicConfigDto> {
    const config: ChatbotConfig = await this._configService.getChatbotConfig(
      {
        select: ['name', 'icon', 'function', 'primary_color', 'secondary_color', 'problematic', 'audience',
          'embedded_icon', 'description', 'help', 'help_btn', 'maintenance_mode', 'show_intent_search', 'dismiss_quick_replies',
          'show_feedback', 'block_type_text', 'show_reboot_btn', 'delay_between_messages', 'is_tree', 'show_faq', 'chat_btn', 'faq_btn']
      }
      );
    return config ? plainToInstance(PublicConfigDto, camelcaseKeys(config, {deep: true})) : null;
  }

  @Get('/intents')
  @ApiOperation({summary: 'Retourne un nombre défini de connaissances qui matchent avec la query'})
  async getIntents(@Query('query') query: string,
                   @Query('intentsNumber') intentsNumber: number,
                   @Query('getResponses') getResponses: boolean): Promise<IntentDto[]> {
    const intents: Intent[] = await this._intentService.findIntentsMatching(decodeURIComponent(query), intentsNumber, getResponses);
    return plainToInstance(IntentDto, camelcaseKeys(intents, {deep: true}));
  }

  @Post('/intents')
  @ApiOperation({summary: 'Retourne les questions principales des connaissances'})
  async getIntentsName(@Body() intentsId: string[]): Promise<IntentDto[]> {
    const intents: Intent[] = await this._intentService.findIntentsMainQuestions(intentsId);
    return plainToInstance(IntentDto, camelcaseKeys(intents, {deep: true}));
  }

  @Post('/faq')
  @ApiOperation({summary: 'L\'utilisateur se connecte à la FAQ'})
  async connectToFaq(@Body() body: { senderId: string }): Promise<void> {
    await this._faqService.connectToFaq(body.senderId);
    return;
  }

  @Post('/faq/:intentId')
  @ApiOperation({summary: 'L\'utilisateur clique sur un intent'})
  async clickIntent(@Body() body: { senderId: string },
                    @Param('intentId') intentId: string): Promise<void> {
    await this._faqService.clickIntent(body.senderId, intentId);
    return;
  }

  @Get('/categories')
  @ApiOperation({summary: 'Retourne toute les catégories actives'})
  async getCategories(): Promise<string[]> {
    return await this._intentService.findAllCategories(true);
  }

  @Get('/category/:category')
  @ApiOperation({summary: 'Retourne toutes les connaissances d\'une catégorie'})
  async getCategory(@Query() options: { senderId: string },
                    @Param('category') category: string): Promise<IntentDto[]> {
    await this._faqService.searchCategory(options.senderId, category);
    const intents: Intent[] = await this._intentService.findByCategory(decodeURIComponent(category));
    return plainToInstance(IntentDto, camelcaseKeys(intents, {deep: true}));
  }

  @Post('/feedback')
  @ApiOperation({summary: 'Création d\'un feedback suite à une réponse du Chatbot'})
  async createFeedback(@Body() feedbackDto: FeedbackDto): Promise<FeedbackDto> {
    const feedback = await this._feedbackService.createSafe(plainToInstance(Feedback, snakecaseKeys(feedbackDto)));
    return plainToInstance(FeedbackDto, camelcaseKeys(feedback, {deep: true}));
  }
}
