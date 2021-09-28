import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UpdateChatbotDto } from "@core/dto/update-chatbot.dto";
import { AnsiblePlaybook, Options } from "ansible-playbook-cli-js";
import { ChatbotConfigService } from "../chatbot-config/chatbot-config.service";
import * as fs from "fs";
import { BotLogger } from "../logger/bot.logger";
import { ChatbotConfig } from "@core/entities/chatbot-config.entity";
import { dotenvToJson, jsonToDotenv } from "@core/utils";

@Injectable()
export class UpdateService {
  private readonly _logger = new BotLogger('UpdateService');

  private _appDir = '/var/www/chatbot-back';
  private _gitDir = '/var/www/git/chatbot-back';

  constructor(private _configService: ChatbotConfigService) {
  }

  async launchUpdate(updateChatbot: UpdateChatbotDto, files, retry = false) {
    const config: ChatbotConfig = await this._configService.getChatbotConfig();
    if (config.need_update && !retry) {
      this._logger.error('UPDATE - update already planned', null);
      throw new HttpException(`Une mise à jour est déjà prévue.`, HttpStatus.NOT_ACCEPTABLE);
    }
    await this._configService.update(<ChatbotConfig>{need_update: true});
    if (config.training_rasa) {
      this._logger.log('UPDATE - Waiting for RASA to train bot');
      setTimeout(() => {
        this.launchUpdate(updateChatbot, files, true)
      }, 60 * 1000);
    } else {
      try {
        await this.update(updateChatbot, files);
      } catch (err) {
      }
      await this._configService.update(<ChatbotConfig>{need_update: false});
    }
  }

  async update(updateChatbot: UpdateChatbotDto, files) {
    this._logger.log('Updating Chatbot...', JSON.stringify(updateChatbot));
    await this._updateChatbotRepos(updateChatbot);
    if (updateChatbot.domainName) {
      // @ts-ignore
      await this._configService.update({domain_name: updateChatbot.domainName});
    }
    const chatbotConfig = await this._configService.getChatbotConfig();

    if (files && files.env && files.env[0]) {
      fs.writeFileSync(`${this._appDir}/../git/.env`, files.env[0], 'utf8');
    }
    if (files && files.nginx_conf && files.nginx_conf[0]) {
      fs.writeFileSync(`${this._appDir}/../git/nginx.conf`, files.nginx_conf[0].buffer, 'utf8');
    }
    if (files && files.nginx_site && files.nginx_site[0]) {
      fs.writeFileSync(`${this._appDir}/../git/nginx_conf.cfg`, files.nginx_site[0].buffer, 'utf8');
    }

    const playbookOptions = new Options(`${this._gitDir}/ansible`);
    const ansiblePlaybook = new AnsiblePlaybook(playbookOptions);
    const extraVars = {
      ...updateChatbot, ...{
        botDomain: chatbotConfig.domain_name,
        DB_PASSWORD: process.env.DATABASE_PASSWORD
      }
    };
    this._logger.log('DEPLOYING CHATBOT APP');
    await ansiblePlaybook.command(`playDeployapp.yml -e '${JSON.stringify(extraVars)}'`).then(async (result) => {
      this._logger.log(JSON.stringify(result));
      // if (updateChatbot.updateLogs && updateChatbot.elastic_host && updateChatbot.elastic_username && updateChatbot.elastic_password) {
      //   await ansiblePlaybook.command(`elastic/elastic.yml -e '${JSON.stringify(extraVars)}'`).then((result) => {
      //     this._logger.log(JSON.stringify(result));
      //   })
      // }
      if (updateChatbot.updateBack) {
        await ansiblePlaybook.command(`playReloadback.yml -e '${JSON.stringify(extraVars)}'`).then((result) => {
          this._logger.log(JSON.stringify(result));
        })
      }
    }).catch((e) => {
      this._logger.error('ERROR DEPLOYING CHATBOT APP', e);
    });
  }

  async updateDomainName(domainName: string) {
    const playbookOptions = new Options(`${this._gitDir}/ansible`);
    const ansiblePlaybook = new AnsiblePlaybook(playbookOptions);
    const extraVars = {
      ...{
        botDomain: domainName
      }
    };
    this._logger.log('UPDATING DOMAIN NAME');
    await ansiblePlaybook.command(`playUpdatenginx.yml -e '${JSON.stringify(extraVars)}'`).then(async (result) => {
      this._logger.log(JSON.stringify(result));
      this._updateDomainNameEnv(domainName);
    }).catch((e) => {
      this._logger.error('ERROR UPDATING DOMAIN NAME', e);
    });
  }

  private async _updateDomainNameEnv(domainName: string) {
    this._logger.log('UPDATING DOMAIN NAME ENV');
    let dotenv = dotenvToJson(fs.readFileSync(`${this._appDir}/.env`, 'utf8'));
    dotenv.HOST_URL = `https://${domainName}`;

    try {
      fs.writeFileSync(`${this._appDir}/.env`, jsonToDotenv(dotenv), 'utf8');
      fs.writeFileSync(`${this._appDir}/dist/.env`, jsonToDotenv(dotenv), 'utf8');
      const playbookOptions = new Options(`${this._gitDir}/ansible`);
      const ansiblePlaybook = new AnsiblePlaybook(playbookOptions);
      await ansiblePlaybook.command(`playReloadback.yml -e '{"updateBack": true}'`).then((result) => {
        this._logger.log(JSON.stringify(result));
      });
    } catch (e) {
      this._logger.error('ERROR UPDATING DOMAIN NAME ENV', e);
    }
  }

  private async _updateChatbotRepos(updateChatbot: UpdateChatbotDto) {
    const playbookOptions = new Options(`${this._appDir}/ansible`);
    const ansiblePlaybook = new AnsiblePlaybook(playbookOptions);
    this._logger.log('UPDATING CHATBOTS REPOSITORIES');
    await ansiblePlaybook.command(`playUpdaterepos.yml -e '${JSON.stringify(updateChatbot)}'`).then(async (result) => {
      this._logger.log(JSON.stringify(result));
    }).catch(error => {
      this._logger.log('ERRROR UPDATING CHATBOTS REPOSITORIES', error);
    });
  }
}
