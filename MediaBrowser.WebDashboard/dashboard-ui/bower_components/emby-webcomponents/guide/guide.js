define(["require","inputManager","browser","globalize","connectionManager","scrollHelper","serverNotifications","loading","datetime","focusManager","playbackManager","userSettings","imageLoader","events","layoutManager","itemShortcuts","registrationServices","dom","clearButtonStyle","css!./guide.css","programStyles","material-icons","scrollStyles","emby-button","paper-icon-button-light","emby-tabs","emby-scroller","flexStyles","registerElement"],function(require,inputManager,browser,globalize,connectionManager,scrollHelper,serverNotifications,loading,datetime,focusManager,playbackManager,userSettings,imageLoader,events,layoutManager,itemShortcuts,registrationServices,dom){"use strict";function showViewSettings(instance){require(["guide-settings-dialog"],function(guideSettingsDialog){guideSettingsDialog.show(instance.categoryOptions).then(function(){instance.refresh()})})}function updateProgramCellOnScroll(cell,scrollPct){var left=cell.posLeft;left||(left=parseFloat(cell.style.left.replace("%","")),cell.posLeft=left);var width=cell.posWidth;width||(width=parseFloat(cell.style.width.replace("%","")),cell.posWidth=width);var right=left+width,newPct=Math.max(Math.min(scrollPct,right),left),offset=newPct-left,pctOfWidth=offset/width*100,guideProgramName=cell.guideProgramName;guideProgramName||(guideProgramName=cell.querySelector(".guideProgramName"),cell.guideProgramName=guideProgramName);var caret=cell.caret;caret||(caret=cell.querySelector(".guideProgramNameCaret"),cell.caret=caret),guideProgramName&&(pctOfWidth>0&&pctOfWidth<=100?(guideProgramName.style.transform="translateX("+pctOfWidth+"%)",caret.classList.remove("hide")):(guideProgramName.style.transform="none",caret.classList.add("hide")))}function updateProgramCellsOnScroll(programGrid,programCells){isUpdatingProgramCellScroll||(isUpdatingProgramCellScroll=!0,requestAnimationFrame(function(){for(var scrollLeft=programGrid.scrollLeft,scrollPct=scrollLeft?scrollLeft/programGrid.scrollWidth*100:0,i=0,length=programCells.length;i<length;i++)updateProgramCellOnScroll(programCells[i],scrollPct);isUpdatingProgramCellScroll=!1}))}function onProgramGridClick(e){var programCell=dom.parentWithClass(e.target,"programCell");if(programCell){var startDate=programCell.getAttribute("data-startdate"),endDate=programCell.getAttribute("data-enddate");startDate=datetime.parseISO8601Date(startDate,{toLocal:!0}).getTime(),endDate=datetime.parseISO8601Date(endDate,{toLocal:!0}).getTime();var now=(new Date).getTime();if(now>=startDate&&now<endDate){var channelId=programCell.getAttribute("data-channelid"),serverId=programCell.getAttribute("data-serverid");e.preventDefault(),e.stopPropagation(),playbackManager.play({ids:[channelId],serverId:serverId})}}}function Guide(options){function restartAutoRefresh(){stopAutoRefresh();var intervalMs=9e5;autoRefreshInterval=setInterval(function(){self.refresh()},intervalMs)}function stopAutoRefresh(){autoRefreshInterval&&(clearInterval(autoRefreshInterval),autoRefreshInterval=null)}function normalizeDateToTimeslot(date){var minutesOffset=date.getMinutes()-cellCurationMinutes;return minutesOffset>=0?date.setHours(date.getHours(),cellCurationMinutes,0,0):date.setHours(date.getHours(),0,0,0),date}function showLoading(){loading.show()}function hideLoading(){loading.hide()}function startCurrentTimeUpdateInterval(){clearCurrentTimeUpdateInterval(),currentTimeUpdateInterval=setInterval(updateCurrentTimeIndicator,6e4),updateCurrentTimeIndicator()}function clearCurrentTimeUpdateInterval(){var interval=currentTimeUpdateInterval;interval&&clearInterval(interval),currentTimeUpdateInterval=null,currentTimeIndicatorBar=null,currentTimeIndicatorArrow=null}function updateCurrentTimeIndicator(){if(currentTimeIndicatorBar||(currentTimeIndicatorBar=options.element.querySelector(".currentTimeIndicatorBar")),currentTimeIndicatorArrow||(currentTimeIndicatorArrow=options.element.querySelector(".currentTimeIndicatorArrowContainer")),currentDate){var dateDifference=(new Date).getTime()-currentDate.getTime(),pct=dateDifference>0?dateDifference/totalRendererdMs:0;pct=Math.min(pct,1),pct<=0||pct>=1?(currentTimeIndicatorBar.classList.add("hide"),currentTimeIndicatorArrow.classList.add("hide")):(currentTimeIndicatorBar.classList.remove("hide"),currentTimeIndicatorArrow.classList.remove("hide"),currentTimeIndicatorBar.style.transform="scaleX("+pct+")",currentTimeIndicatorArrow.style.left=100*pct+"%")}}function getChannelLimit(context){return registrationServices.validateFeature("livetv").then(function(){var limit=browser.slow?100:500;return context.querySelector(".guideRequiresUnlock").classList.add("hide"),limit},function(){var limit=5;return context.querySelector(".guideRequiresUnlock").classList.remove("hide"),context.querySelector(".unlockText").innerHTML=globalize.translate("sharedcomponents#LiveTvGuideRequiresUnlock",limit),limit})}function reloadGuide(context,newStartDate,scrollToTimeMs,focusToTimeMs,startTimeOfDayMs,focusProgramOnRender){var apiClient=connectionManager.currentApiClient(),channelQuery={StartIndex:0,EnableFavoriteSorting:"false"!==userSettings.get("livetv-favoritechannelsattop")};channelQuery.UserId=apiClient.getCurrentUserId(),getChannelLimit(context).then(function(channelLimit){currentChannelLimit=channelLimit,showLoading(),channelQuery.StartIndex=currentStartIndex,channelQuery.Limit=channelLimit,channelQuery.AddCurrentProgram=!1,channelQuery.EnableUserData=!1,channelQuery.EnableImageTypes="Primary";var categories=self.categoryOptions.categories||[],displayMovieContent=!categories.length||categories.indexOf("movies")!==-1,displaySportsContent=!categories.length||categories.indexOf("sports")!==-1,displayNewsContent=!categories.length||categories.indexOf("news")!==-1,displayKidsContent=!categories.length||categories.indexOf("kids")!==-1,displaySeriesContent=!categories.length||categories.indexOf("series")!==-1;displayMovieContent&&displaySportsContent&&displayNewsContent&&displayKidsContent?(channelQuery.IsMovie=null,channelQuery.IsSports=null,channelQuery.IsKids=null,channelQuery.IsNews=null,channelQuery.IsSeries=null):(displayNewsContent&&(channelQuery.IsNews=!0),displaySportsContent&&(channelQuery.IsSports=!0),displayKidsContent&&(channelQuery.IsKids=!0),displayMovieContent&&(channelQuery.IsMovie=!0),displaySeriesContent&&(channelQuery.IsSeries=!0)),"DatePlayed"===userSettings.get("livetv-channelorder")?(channelQuery.SortBy="DatePlayed",channelQuery.SortOrder="Descending"):(channelQuery.SortBy=null,channelQuery.SortOrder=null);var date=newStartDate;date=new Date(date.getTime()+1e3);var nextDay=new Date(date.getTime()+msPerDay-2e3);apiClient.getLiveTvChannels(channelQuery).then(function(channelsResult){var btnPreviousPage=context.querySelector(".btnPreviousPage"),btnNextPage=context.querySelector(".btnNextPage");channelsResult.TotalRecordCount>channelLimit?(context.querySelector(".guideOptions").classList.remove("hide"),btnPreviousPage.classList.remove("hide"),btnNextPage.classList.remove("hide"),channelQuery.StartIndex?context.querySelector(".btnPreviousPage").disabled=!1:context.querySelector(".btnPreviousPage").disabled=!0,channelQuery.StartIndex+channelLimit<channelsResult.TotalRecordCount?btnNextPage.disabled=!1:btnNextPage.disabled=!0):context.querySelector(".guideOptions").classList.add("hide"),apiClient.getLiveTvPrograms({UserId:apiClient.getCurrentUserId(),MaxStartDate:nextDay.toISOString(),MinEndDate:date.toISOString(),channelIds:channelsResult.Items.map(function(c){return c.Id}).join(","),ImageTypeLimit:1,EnableImages:!1,SortBy:"StartDate",EnableTotalRecordCount:!1,EnableUserData:!1}).then(function(programsResult){renderGuide(context,date,channelsResult.Items,programsResult.Items,apiClient,scrollToTimeMs,focusToTimeMs,startTimeOfDayMs,focusProgramOnRender),hideLoading()})})})}function getDisplayTime(date){if("string"===(typeof date).toString().toLowerCase())try{date=datetime.parseISO8601Date(date,{toLocal:!0})}catch(err){return date}return datetime.getDisplayTime(date).toLowerCase()}function getTimeslotHeadersHtml(startDate,endDateTime){var html="";for(startDate=new Date(startDate.getTime()),html+='<div class="timeslotHeadersInner">';startDate.getTime()<endDateTime;)html+='<div class="timeslotHeader">',html+=getDisplayTime(startDate),html+="</div>",startDate.setTime(startDate.getTime()+cellDurationMs);return html+='<div class="currentTimeIndicatorBar hide">',html+="</div>",html+='<div class="currentTimeIndicatorArrowContainer hide">',html+='<i class="currentTimeIndicatorArrow md-icon">arrow_drop_down</i>',html+="</div>"}function parseDates(program){if(!program.StartDateLocal)try{program.StartDateLocal=datetime.parseISO8601Date(program.StartDate,{toLocal:!0})}catch(err){}if(!program.EndDateLocal)try{program.EndDateLocal=datetime.parseISO8601Date(program.EndDate,{toLocal:!0})}catch(err){}return null}function getTimerIndicator(item){var status;if("SeriesTimer"===item.Type)return'<i class="md-icon programIcon seriesTimerIcon">&#xE062;</i>';if(item.TimerId||item.SeriesTimerId)status=item.Status||"Cancelled";else{if("Timer"!==item.Type)return"";status=item.Status}return item.SeriesTimerId?"Cancelled"!==status?'<i class="md-icon programIcon seriesTimerIcon">&#xE062;</i>':'<i class="md-icon programIcon seriesTimerIcon seriesTimerIcon-inactive">&#xE062;</i>':'<i class="md-icon programIcon timerIcon">&#xE061;</i>'}function getChannelProgramsHtml(context,date,channel,programs,options,listInfo){var html="",startMs=date.getTime(),endMs=startMs+msPerDay-1,outerCssClass=layoutManager.tv?"channelPrograms channelPrograms-tv":"channelPrograms";html+='<div class="'+outerCssClass+'" data-channelid="'+channel.Id+'">';for(var programsFound,clickAction=layoutManager.tv?"link":"programdialog",categories=self.categoryOptions.categories||[],displayMovieContent=!categories.length||categories.indexOf("movies")!==-1,displaySportsContent=!categories.length||categories.indexOf("sports")!==-1,displayNewsContent=!categories.length||categories.indexOf("news")!==-1,displayKidsContent=!categories.length||categories.indexOf("kids")!==-1,displaySeriesContent=!categories.length||categories.indexOf("series")!==-1,enableColorCodedBackgrounds="true"===userSettings.get("guide-colorcodedbackgrounds"),i=listInfo.startIndex,length=programs.length;i<length;i++){var program=programs[i];if(program.ChannelId===channel.Id){if(programsFound=!0,listInfo.startIndex++,parseDates(program),!(program.EndDateLocal.getTime()<startMs)){if(program.StartDateLocal.getTime()>endMs)break;items[program.Id]=program;var renderStartMs=Math.max(program.StartDateLocal.getTime(),startMs),startPercent=(program.StartDateLocal.getTime()-startMs)/msPerDay;startPercent*=100,startPercent=Math.max(startPercent,0);var renderEndMs=Math.min(program.EndDateLocal.getTime(),endMs),endPercent=(renderEndMs-renderStartMs)/msPerDay;endPercent*=100;var cssClass="programCell clearButton itemAction",accentCssClass=null,displayInnerContent=!0;program.IsKids?(cssClass+=" childProgramInfo",displayInnerContent=displayKidsContent,accentCssClass="childAccent"):program.IsSports?(cssClass+=" sportsProgramInfo",displayInnerContent=displaySportsContent,accentCssClass="sportsAccent"):program.IsNews?(cssClass+=" newsProgramInfo",displayInnerContent=displayNewsContent,accentCssClass="newsAccent"):program.IsMovie?(cssClass+=" movieProgramInfo",displayInnerContent=displayMovieContent,accentCssClass="movieAccent"):program.IsSeries?(cssClass+=" plainProgramInfo",displayInnerContent=displaySeriesContent):(cssClass+=" plainProgramInfo",displayInnerContent=displayMovieContent&&displayNewsContent&&displaySportsContent&&displayKidsContent&&displaySeriesContent);var timerAttributes="";program.TimerId&&(timerAttributes+=' data-timerid="'+program.TimerId+'"'),program.SeriesTimerId&&(timerAttributes+=' data-seriestimerid="'+program.SeriesTimerId+'"');var isAttribute=endPercent>=2?' is="emby-programcell"':"";if(html+="<button"+isAttribute+' data-action="'+clickAction+'"'+timerAttributes+' data-channelid="'+program.ChannelId+'" data-id="'+program.Id+'" data-serverid="'+program.ServerId+'" data-startdate="'+program.StartDate+'" data-enddate="'+program.EndDate+'" data-type="'+program.Type+'" class="'+cssClass+'" style="left:'+startPercent+"%;width:"+endPercent+'%;">',html+=displayInnerContent&&enableColorCodedBackgrounds&&accentCssClass?'<div class="programCellInner '+accentCssClass+'">':'<div class="programCellInner">',displayInnerContent){var guideProgramNameClass="guideProgramName";html+='<div class="'+guideProgramNameClass+'">',html+='<div class="guideProgramNameCaret hide"><i class="guideProgramNameCaretIcon md-icon">&#xE314;</i></div>',html+='<div class="guideProgramNameText">'+program.Name;var indicatorHtml=null;program.IsLive&&options.showLiveIndicator?indicatorHtml='<span class="liveTvProgram guideProgramIndicator">'+globalize.translate("sharedcomponents#Live")+"</span>":program.IsPremiere&&options.showPremiereIndicator?indicatorHtml='<span class="premiereTvProgram guideProgramIndicator">'+globalize.translate("sharedcomponents#Premiere")+"</span>":program.IsSeries&&!program.IsRepeat&&options.showNewIndicator?indicatorHtml='<span class="newTvProgram guideProgramIndicator">'+globalize.translate("sharedcomponents#AttributeNew")+"</span>":program.IsSeries&&program.IsRepeat&&options.showRepeatIndicator&&(indicatorHtml='<span class="repeatTvProgram guideProgramIndicator">'+globalize.translate("sharedcomponents#Repeat")+"</span>"),html+=indicatorHtml||"",program.EpisodeTitle&&options.showEpisodeTitle&&(html+='<div class="guideProgramSecondaryInfo">',program.EpisodeTitle&&options.showEpisodeTitle&&(html+='<span class="programSecondaryTitle">'+program.EpisodeTitle+"</span>"),html+="</div>"),html+="</div>",program.IsHD&&options.showHdIcon&&(html+=layoutManager.tv?'<div class="programIcon programTextIcon programTextIcon-tv">HD</div>':'<div class="programIcon programTextIcon">HD</div>'),html+=getTimerIndicator(program),html+="</div>"}html+="</div>",html+="</button>"}}else if(programsFound)break}return html+="</div>"}function renderChannelHeaders(context,channels,apiClient){for(var html="",i=0,length=channels.length;i<length;i++){var channel=channels[i],hasChannelImage=channel.ImageTags.Primary,dataSrc="";if(hasChannelImage){var url=apiClient.getScaledImageUrl(channel.Id,{maxHeight:220,tag:channel.ImageTags.Primary,type:"Primary"});dataSrc=' data-src="'+url+'"'}var cssClass="channelHeaderCell clearButton itemAction lazy";layoutManager.tv&&(cssClass+=" channelHeaderCell-tv");var title=[];channel.Number&&title.push(channel.Number),channel.Name&&title.push(channel.Name),html+='<button title="'+title.join(" ")+'" type="button" class="'+cssClass+'"'+dataSrc+' data-action="link" data-isfolder="'+channel.IsFolder+'" data-id="'+channel.Id+'" data-serverid="'+channel.ServerId+'" data-type="'+channel.Type+'">',channel.Number&&(html+='<h3 class="guideChannelNumber">'+channel.Number+"</h3>"),!hasChannelImage&&channel.Name&&(html+='<div class="guideChannelName">'+channel.Name+"</div>"),html+="</button>"}var channelList=context.querySelector(".channelsContainer");channelList.innerHTML=html,imageLoader.lazyChildren(channelList)}function renderPrograms(context,date,channels,programs){for(var allowIndicators=dom.getWindowSize().innerWidth>=600,options={showHdIcon:allowIndicators&&"true"===userSettings.get("guide-indicator-hd"),showLiveIndicator:allowIndicators&&"false"!==userSettings.get("guide-indicator-live"),showPremiereIndicator:allowIndicators&&"false"!==userSettings.get("guide-indicator-premiere"),showNewIndicator:allowIndicators&&"true"===userSettings.get("guide-indicator-new"),showRepeatIndicator:allowIndicators&&"true"===userSettings.get("guide-indicator-repeat"),showEpisodeTitle:!layoutManager.tv},listInfo={startIndex:0},html=[],i=0,length=channels.length;i<length;i++)html.push(getChannelProgramsHtml(context,date,channels[i],programs,options,listInfo));programGrid.innerHTML=html.join(""),programCells=programGrid.querySelectorAll("[is=emby-programcell]"),updateProgramCellsOnScroll(programGrid,programCells)}function getProgramSortOrder(program,channels){for(var channelId=program.ChannelId,channelIndex=-1,i=0,length=channels.length;i<length;i++)if(channelId===channels[i].Id){channelIndex=i;break}var start=datetime.parseISO8601Date(program.StartDate,{toLocal:!0});return 1e7*channelIndex+start.getTime()/6e4}function renderGuide(context,date,channels,programs,apiClient,scrollToTimeMs,focusToTimeMs,startTimeOfDayMs,focusProgramOnRender){programs.sort(function(a,b){return getProgramSortOrder(a,channels)-getProgramSortOrder(b,channels)});var activeElement=document.activeElement,itemId=activeElement&&activeElement.getAttribute?activeElement.getAttribute("data-id"):null,channelRowId=null;activeElement&&(channelRowId=dom.parentWithClass(activeElement,"channelPrograms"),channelRowId=channelRowId&&channelRowId.getAttribute?channelRowId.getAttribute("data-channelid"):null),renderChannelHeaders(context,channels,apiClient);var startDate=date,endDate=new Date(startDate.getTime()+msPerDay);context.querySelector(".timeslotHeaders").innerHTML=getTimeslotHeadersHtml(startDate,endDate),startCurrentTimeUpdateInterval(),items={},renderPrograms(context,date,channels,programs),focusProgramOnRender&&focusProgram(context,itemId,channelRowId,focusToTimeMs,startTimeOfDayMs),scrollProgramGridToTimeMs(context,scrollToTimeMs,startTimeOfDayMs)}function scrollProgramGridToTimeMs(context,scrollToTimeMs,startTimeOfDayMs){scrollToTimeMs-=startTimeOfDayMs;var pct=scrollToTimeMs/msPerDay;programGrid.scrollTop=0;var scrollPos=pct*programGrid.scrollWidth;nativeScrollTo(programGrid,scrollPos,!0)}function focusProgram(context,itemId,channelRowId,focusToTimeMs,startTimeOfDayMs){var focusElem;if(itemId&&(focusElem=context.querySelector('[data-id="'+itemId+'"]')),focusElem)focusManager.focus(focusElem);else{var autoFocusParent;channelRowId&&(autoFocusParent=context.querySelector('[data-channelid="'+channelRowId+'"]')),autoFocusParent||(autoFocusParent=programGrid),focusToTimeMs-=startTimeOfDayMs;for(var pct=focusToTimeMs/msPerDay*100,programCell=autoFocusParent.querySelector(".programCell");programCell;){var left=(programCell.style.left||"").replace("%","");left=left?parseFloat(left):0;var width=(programCell.style.width||"").replace("%","");if(width=width?parseFloat(width):0,left>=pct||left+width>=pct)break;programCell=programCell.nextSibling}programCell?focusManager.focus(programCell):focusManager.autoFocus(autoFocusParent,!0)}}function nativeScrollTo(container,pos,horizontal){container.scrollTo?horizontal?container.scrollTo(pos,0):container.scrollTo(0,pos):horizontal?container.scrollLeft=Math.round(pos):container.scrollTop=Math.round(pos)}function onProgramGridScroll(context,elem,timeslotHeaders){(new Date).getTime()-lastHeaderScroll>=1e3&&(lastGridScroll=(new Date).getTime(),nativeScrollTo(timeslotHeaders,elem.scrollLeft,!0)),updateProgramCellsOnScroll(elem,programCells)}function onTimeslotHeadersScroll(context,elem){(new Date).getTime()-lastGridScroll>=1e3&&(lastHeaderScroll=(new Date).getTime(),nativeScrollTo(programGrid,elem.scrollLeft,!0))}function changeDate(page,date,scrollToTimeMs,focusToTimeMs,startTimeOfDayMs,focusProgramOnRender){clearCurrentTimeUpdateInterval();var newStartDate=normalizeDateToTimeslot(date);currentDate=newStartDate,reloadGuide(page,newStartDate,scrollToTimeMs,focusToTimeMs,startTimeOfDayMs,focusProgramOnRender)}function getDateTabText(date,isActive,tabIndex){var cssClass=isActive?"emby-tab-button guide-date-tab-button emby-tab-button-active":"emby-tab-button guide-date-tab-button",html='<button is="emby-button" class="'+cssClass+'" data-index="'+tabIndex+'" data-date="'+date.getTime()+'">',tabText=datetime.toLocaleDateString(date,{weekday:"short"});return tabText+="<br/>",tabText+=date.getDate(),html+='<div class="emby-button-foreground">'+tabText+"</div>",html+="</button>"}function setDateRange(page,guideInfo){var today=new Date,nowHours=today.getHours();today.setHours(nowHours,0,0,0);var start=datetime.parseISO8601Date(guideInfo.StartDate,{toLocal:!0}),end=datetime.parseISO8601Date(guideInfo.EndDate,{toLocal:!0});start.setHours(nowHours,0,0,0),end.setHours(0,0,0,0),start.getTime()>=end.getTime()&&end.setDate(start.getDate()+1),start=new Date(Math.max(today,start));var dateTabsHtml="",tabIndex=0,date=new Date;currentDate&&date.setTime(currentDate.getTime()),date.setHours(nowHours,0,0,0);var startTimeOfDayMs=60*start.getHours()*60*1e3;for(startTimeOfDayMs+=60*start.getMinutes()*1e3;start<=end;){var isActive=date.getDate()===start.getDate()&&date.getMonth()===start.getMonth()&&date.getFullYear()===start.getFullYear();dateTabsHtml+=getDateTabText(start,isActive,tabIndex),start.setDate(start.getDate()+1),start.setHours(0,0,0,0),tabIndex++}page.querySelector(".emby-tabs-slider").innerHTML=dateTabsHtml,page.querySelector(".guideDateTabs").refresh();var newDate=new Date,newDateHours=newDate.getHours(),scrollToTimeMs=60*newDateHours*60*1e3,minutes=newDate.getMinutes();minutes>=30&&(scrollToTimeMs+=18e5);var focusToTimeMs=60*(60*newDateHours+minutes)*1e3;changeDate(page,date,scrollToTimeMs,focusToTimeMs,startTimeOfDayMs,layoutManager.tv)}function reloadPage(page){showLoading();var apiClient=connectionManager.currentApiClient();apiClient.getLiveTvGuideInfo().then(function(guideInfo){setDateRange(page,guideInfo)})}function getChildren(element){var nativeResult=element.children;if(nativeResult)return nativeResult;for(var node,i=0,nodes=element.childNodes,children=[];null!=(node=nodes[i++]);)1===node.nodeType&&children.push(node);return children}function isFirstChild(element){var children=getChildren(element.parentNode);return element===children[0]}function isLastChild(element){var children=getChildren(element.parentNode);return children.length>0&&element===children[children.length-1]}function onInputCommand(e){var container,target=e.target,programCell=dom.parentWithClass(target,"programCell"),scrollX=!1;switch(e.detail.command){case"up":container=programCell?programGrid:null,container&&isFirstChild(dom.parentWithClass(programCell,"channelPrograms"))&&(container=null),lastFocusDirection=e.detail.command,focusManager.moveUp(target,{container:container});break;case"down":container=programCell?programGrid:null,container&&isLastChild(dom.parentWithClass(programCell,"channelPrograms"))&&(container=null),lastFocusDirection=e.detail.command,focusManager.moveDown(target,{container:container});break;case"left":container=programCell?dom.parentWithClass(programCell,"channelPrograms"):null,container&&isFirstChild(programCell)&&(container=null),lastFocusDirection=e.detail.command,focusManager.moveLeft(target,{container:container}),scrollX=!0;break;case"right":container=programCell?dom.parentWithClass(programCell,"channelPrograms"):null,lastFocusDirection=e.detail.command,focusManager.moveRight(target,{container:container}),scrollX=!0;break;default:return}e.preventDefault(),e.stopPropagation()}function onScrollerFocus(e){var target=e.target,programCell=dom.parentWithClass(target,"programCell");if(programCell){var focused=target,id=focused.getAttribute("data-id"),item=items[id];item&&events.trigger(self,"focus",[{item:item}])}if("left"===lastFocusDirection||"right"===lastFocusDirection)programCell&&scrollHelper.toCenter(programGrid,programCell,!0);else if("up"===lastFocusDirection||"down"===lastFocusDirection){var verticalScroller=dom.parentWithClass(target,"guideVerticalScroller");if(verticalScroller){var focusedElement=programCell||dom.parentWithTag(target,"BUTTON");verticalScroller.toCenter(focusedElement,!0)}}}function setScrollEvents(view,enabled){if(layoutManager.tv){var guideVerticalScroller=view.querySelector(".guideVerticalScroller");enabled?inputManager.on(guideVerticalScroller,onInputCommand):inputManager.off(guideVerticalScroller,onInputCommand)}}function onTimerCreated(e,apiClient,data){for(var programId=data.ProgramId,newTimerId=data.Id,cells=options.element.querySelectorAll('.programCell[data-id="'+programId+'"]'),i=0,length=cells.length;i<length;i++){var cell=cells[i],icon=cell.querySelector(".timerIcon");icon||cell.querySelector(".guideProgramName").insertAdjacentHTML("beforeend",'<i class="timerIcon md-icon programIcon">&#xE061;</i>'),newTimerId&&cell.setAttribute("data-timerid",newTimerId)}}function onSeriesTimerCreated(e,apiClient,data){}function onTimerCancelled(e,apiClient,data){for(var id=data.Id,cells=options.element.querySelectorAll('.programCell[data-timerid="'+id+'"]'),i=0,length=cells.length;i<length;i++){var cell=cells[i],icon=cell.querySelector(".timerIcon");icon&&icon.parentNode.removeChild(icon),cell.removeAttribute("data-timerid")}}function onSeriesTimerCancelled(e,apiClient,data){for(var id=data.Id,cells=options.element.querySelectorAll('.programCell[data-seriestimerid="'+id+'"]'),i=0,length=cells.length;i<length;i++){var cell=cells[i],icon=cell.querySelector(".seriesTimerIcon");icon&&icon.parentNode.removeChild(icon),cell.removeAttribute("data-seriestimerid")}}var self=this,items={};self.options=options,self.categoryOptions={categories:[]};var currentDate,autoRefreshInterval,programCells,lastFocusDirection,programGrid,cellCurationMinutes=30,cellDurationMs=60*cellCurationMinutes*1e3,msPerDay=864e5,totalRendererdMs=msPerDay,currentStartIndex=0,currentChannelLimit=0;self.refresh=function(){currentDate=null,reloadPage(options.element),restartAutoRefresh()},self.pause=function(){stopAutoRefresh()},self.resume=function(refreshData){refreshData?self.refresh():restartAutoRefresh()},self.destroy=function(){stopAutoRefresh(),events.off(serverNotifications,"TimerCreated",onTimerCreated),events.off(serverNotifications,"SeriesTimerCreated",onSeriesTimerCreated),events.off(serverNotifications,"TimerCancelled",onTimerCancelled),events.off(serverNotifications,"SeriesTimerCancelled",onSeriesTimerCancelled),clearCurrentTimeUpdateInterval(),setScrollEvents(options.element,!1),itemShortcuts.off(options.element),items={}};var currentTimeUpdateInterval,currentTimeIndicatorBar,currentTimeIndicatorArrow,lastGridScroll=0,lastHeaderScroll=0;require(["text!./tvguide.template.html"],function(template){var context=options.element;if(context.classList.add("tvguide"),context.innerHTML=globalize.translateDocument(template,"sharedcomponents"),layoutManager.desktop)for(var guideScrollers=context.querySelectorAll(".guideScroller"),i=0,length=guideScrollers.length;i<length;i++)guideScrollers[i].classList.add("darkScroller");programGrid=context.querySelector(".programGrid");var timeslotHeaders=context.querySelector(".timeslotHeaders");layoutManager.tv&&dom.addEventListener(context.querySelector(".guideVerticalScroller"),"focus",onScrollerFocus,{capture:!0,passive:!0}),(browser.iOS||browser.osx)&&(context.querySelector(".channelsContainer").classList.add("noRubberBanding"),programGrid.classList.add("noRubberBanding")),dom.addEventListener(programGrid,"scroll",function(e){onProgramGridScroll(context,this,timeslotHeaders)},{passive:!0}),dom.addEventListener(timeslotHeaders,"scroll",function(){onTimeslotHeadersScroll(context,this)},{passive:!0}),programGrid.addEventListener("click",onProgramGridClick),context.querySelector(".btnUnlockGuide").addEventListener("click",function(){currentStartIndex=0,reloadPage(context),restartAutoRefresh()}),context.querySelector(".btnNextPage").addEventListener("click",function(){currentStartIndex+=currentChannelLimit,reloadPage(context),restartAutoRefresh()}),context.querySelector(".btnPreviousPage").addEventListener("click",function(){currentStartIndex=Math.max(currentStartIndex-currentChannelLimit,0),reloadPage(context),restartAutoRefresh()}),context.querySelector(".btnGuideViewSettings").addEventListener("click",function(){showViewSettings(self),restartAutoRefresh()}),context.querySelector(".guideDateTabs").addEventListener("tabchange",function(e){var allTabButtons=e.target.querySelectorAll(".guide-date-tab-button"),tabButton=allTabButtons[parseInt(e.detail.selectedTabIndex)];if(tabButton){var previousButton=null==e.detail.previousIndex?null:allTabButtons[parseInt(e.detail.previousIndex)],date=new Date;date.setTime(parseInt(tabButton.getAttribute("data-date")));var scrollToTimeMs,scrollWidth=programGrid.scrollWidth;if(scrollToTimeMs=scrollWidth?programGrid.scrollLeft/scrollWidth*msPerDay:0,previousButton){var previousDate=new Date;previousDate.setTime(parseInt(previousButton.getAttribute("data-date"))),scrollToTimeMs+=60*previousDate.getHours()*60*1e3,scrollToTimeMs+=60*previousDate.getMinutes()*1e3}var startTimeOfDayMs=60*date.getHours()*60*1e3;startTimeOfDayMs+=60*date.getMinutes()*1e3,changeDate(context,date,scrollToTimeMs,scrollToTimeMs,startTimeOfDayMs,!1)}}),setScrollEvents(context,!0),itemShortcuts.on(context),events.trigger(self,"load"),events.on(serverNotifications,"TimerCreated",onTimerCreated),events.on(serverNotifications,"SeriesTimerCreated",onSeriesTimerCreated),events.on(serverNotifications,"TimerCancelled",onTimerCancelled),events.on(serverNotifications,"SeriesTimerCancelled",onSeriesTimerCancelled),self.refresh()})}var isUpdatingProgramCellScroll=!1,ProgramCellPrototype=Object.create(HTMLButtonElement.prototype);return ProgramCellPrototype.detachedCallback=function(){this.posLeft=null,this.posWidth=null,this.guideProgramName=null},document.registerElement("emby-programcell",{prototype:ProgramCellPrototype,extends:"button"}),Guide});