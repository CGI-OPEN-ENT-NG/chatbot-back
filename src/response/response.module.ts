import { Module } from '@nestjs/common';
import { ResponseController } from './response.controller';
import { ResponseService } from './response.service';
import { TypeOrmModule } from "@nestjs/typeorm";
import { Response } from "@core/entities/response.entity";
import { ChatbotConfig } from "@core/entities/chatbot-config.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Response, ChatbotConfig])
  ],
  controllers: [ResponseController],
  providers: [ResponseService],
  exports: [ResponseService]
})
export class ResponseModule {}
