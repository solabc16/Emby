define(["serverNotifications","events","scripts/taskbutton","datetime","loading","libraryMenu","libraryBrowser","paper-icon-button-light"],function(serverNotifications,events,taskButton,datetime,loading,libraryMenu,libraryBrowser){"use strict";function parentWithClass(elem,className){for(;!elem.classList||!elem.classList.contains(className);)if(elem=elem.parentNode,!elem)return null;return elem}function showStatusMessage(id){var item=currentResult.Items.filter(function(i){return i.Id===id})[0];Dashboard.alert({title:getStatusText(item,!1),message:item.StatusMessage})}function deleteOriginalFile(page,id){var item=currentResult.Items.filter(function(i){return i.Id===id})[0],message=Globalize.translate("MessageFileWillBeDeleted")+"<br/><br/>"+item.OriginalPath+"<br/><br/>"+Globalize.translate("MessageSureYouWishToProceed");require(["confirm"],function(confirm){confirm(message,Globalize.translate("HeaderDeleteFile")).then(function(){loading.show(),ApiClient.deleteOriginalFileFromOrganizationResult(id).then(function(){loading.hide(),reloadItems(page,!0)},Dashboard.processErrorResponse)})})}function organizeFileWithCorrections(page,item){showCorrectionPopup(page,item)}function showCorrectionPopup(page,item){require(["components/fileorganizer/fileorganizer"],function(fileorganizer){fileorganizer.show(item).then(function(){reloadItems(page,!1)})})}function organizeFile(page,id){var item=currentResult.Items.filter(function(i){return i.Id===id})[0];if(!item.TargetPath)return void("Episode"===item.Type&&organizeFileWithCorrections(page,item));var message=Globalize.translate("MessageFollowingFileWillBeMovedFrom")+"<br/><br/>"+item.OriginalPath+"<br/><br/>"+Globalize.translate("MessageDestinationTo")+"<br/><br/>"+item.TargetPath;item.DuplicatePaths.length&&(message+="<br/><br/>"+Globalize.translate("MessageDuplicatesWillBeDeleted"),message+="<br/><br/>"+item.DuplicatePaths.join("<br/>")),message+="<br/><br/>"+Globalize.translate("MessageSureYouWishToProceed"),require(["confirm"],function(confirm){confirm(message,Globalize.translate("HeaderOrganizeFile")).then(function(){loading.show(),ApiClient.performOrganization(id).then(function(){loading.hide(),reloadItems(page,!0)},Dashboard.processErrorResponse)})})}function reloadItems(page,showSpinner){showSpinner&&loading.show(),ApiClient.getFileOrganizationResults(query).then(function(result){currentResult=result,renderResults(page,result),loading.hide()},Dashboard.processErrorResponse)}function getStatusText(item,enhance){var status=item.Status,color=null;return"SkippedExisting"===status?status=Globalize.translate("StatusSkipped"):"Failure"===status&&(color="#cc0000",status=Globalize.translate("StatusFailed")),"Success"===status&&(color="green",status=Globalize.translate("StatusSuccess")),enhance?item.StatusMessage?'<a style="color:'+color+';" data-resultid="'+item.Id+'" href="#" class="btnShowStatusMessage">'+status+"</a>":'<span data-resultid="'+item.Id+'" style="color:'+color+';">'+status+"</span>":status}function renderResults(page,result){var rows=result.Items.map(function(item){var html="";return html+='<tr id="row'+item.Id+'">',html+=renderItemRow(item),html+="</tr>"}).join(""),resultBody=page.querySelector(".resultBody");resultBody.innerHTML=rows,resultBody.addEventListener("click",handleItemClick);var pagingHtml=libraryBrowser.getQueryPagingHtml({startIndex:query.StartIndex,limit:query.Limit,totalRecordCount:result.TotalRecordCount,showLimit:!1,updatePageSizeSetting:!1}),topPaging=page.querySelector(".listTopPaging");topPaging.innerHTML=pagingHtml;var bottomPaging=page.querySelector(".listBottomPaging");bottomPaging.innerHTML=pagingHtml;var btnNextTop=topPaging.querySelector(".btnNextPage"),btnNextBottom=bottomPaging.querySelector(".btnNextPage"),btnPrevTop=topPaging.querySelector(".btnPreviousPage"),btnPrevBottom=bottomPaging.querySelector(".btnPreviousPage");btnNextTop&&btnNextTop.addEventListener("click",function(){query.StartIndex+=query.Limit,reloadItems(page,!0)}),btnNextBottom&&btnNextBottom.addEventListener("click",function(){query.StartIndex+=query.Limit,reloadItems(page,!0)}),btnPrevTop&&btnPrevTop.addEventListener("click",function(){query.StartIndex-=query.Limit,reloadItems(page,!0)}),btnPrevBottom&&btnPrevBottom.addEventListener("click",function(){query.StartIndex-=query.Limit,reloadItems(page,!0)});var btnClearLog=page.querySelector(".btnClearLog");result.TotalRecordCount?btnClearLog.classList.remove("hide"):btnClearLog.classList.add("hide")}function renderItemRow(item){var html="";html+="<td>";var hide=item.IsInProgress?"":" hide";html+='<img src="css/images/throbber.gif" alt="" class="syncSpinner'+hide+'" style="vertical-align: middle;" />',html+="</td>",html+='<td data-title="Date">';var date=datetime.parseISO8601Date(item.Date,!0);html+=datetime.toLocaleDateString(date),html+="</td>",html+='<td data-title="Source" class="fileCell">';var status=item.Status;return item.IsInProgress?(html+='<span style="color:darkorange;">',html+=item.OriginalFileName,html+="</span>"):"SkippedExisting"===status?(html+='<a data-resultid="'+item.Id+'" style="color:blue;" href="#" class="btnShowStatusMessage">',html+=item.OriginalFileName,html+="</a>"):"Failure"===status?(html+='<a data-resultid="'+item.Id+'" style="color:red;" href="#" class="btnShowStatusMessage">',html+=item.OriginalFileName,html+="</a>"):(html+='<span style="color:green;">',html+=item.OriginalFileName,html+="</span>"),html+="</td>",html+='<td data-title="Destination" class="fileCell">',html+=item.TargetPath||"",html+="</td>",html+='<td class="organizerButtonCell" style="whitespace:no-wrap;">',"Success"!==item.Status&&(html+='<button type="button" is="paper-icon-button-light" data-resultid="'+item.Id+'" class="btnProcessResult organizerButton autoSize" title="'+Globalize.translate("ButtonOrganizeFile")+'"><i class="md-icon">folder</i></button>',html+='<button type="button" is="paper-icon-button-light" data-resultid="'+item.Id+'" class="btnDeleteResult organizerButton autoSize" title="'+Globalize.translate("ButtonDeleteFile")+'"><i class="md-icon">delete</i></button>'),html+="</td>"}function handleItemClick(e){var id,buttonStatus=parentWithClass(e.target,"btnShowStatusMessage");buttonStatus&&(id=buttonStatus.getAttribute("data-resultid"),showStatusMessage(id));var buttonOrganize=parentWithClass(e.target,"btnProcessResult");buttonOrganize&&(id=buttonOrganize.getAttribute("data-resultid"),organizeFile(e.view,id));var buttonDelete=parentWithClass(e.target,"btnDeleteResult");buttonDelete&&(id=buttonDelete.getAttribute("data-resultid"),deleteOriginalFile(e.view,id))}function onServerEvent(e,apiClient,data){"ScheduledTaskEnded"===e.type?data&&"AutoOrganize"===data.Key&&reloadItems(page,!1):"AutoOrganize_ItemUpdated"===e.type&&data?updateItemStatus(page,data):reloadItems(page,!1)}function updateItemStatus(page,item){var rowId="#row"+item.Id,row=page.querySelector(rowId);row&&(row.innerHTML=renderItemRow(item))}function getTabs(){return[{href:"autoorganizelog.html",name:Globalize.translate("TabActivityLog")},{href:"autoorganizetv.html",name:Globalize.translate("TabTV")},{href:"autoorganizesmart.html",name:Globalize.translate("TabSmartMatches")}]}var currentResult,page,query={StartIndex:0,Limit:50};return function(view,params){page=view;var clearButton=view.querySelector(".btnClearLog");clearButton.addEventListener("click",function(){ApiClient.clearOrganizationLog().then(function(){query.StartIndex=0,reloadItems(view,!0)},Dashboard.processErrorResponse)}),view.addEventListener("viewshow",function(e){libraryMenu.setTabs("autoorganize",0,getTabs),reloadItems(view,!0),events.on(serverNotifications,"AutoOrganize_LogReset",onServerEvent),events.on(serverNotifications,"AutoOrganize_ItemUpdated",onServerEvent),events.on(serverNotifications,"AutoOrganize_ItemRemoved",onServerEvent),events.on(serverNotifications,"AutoOrganize_ItemAdded",onServerEvent),events.on(serverNotifications,"ScheduledTaskEnded",onServerEvent),taskButton({mode:"on",progressElem:view.querySelector(".organizeProgress"),panel:view.querySelector(".organizeTaskPanel"),taskKey:"AutoOrganize",button:view.querySelector(".btnOrganize")})}),view.addEventListener("viewhide",function(e){currentResult=null,events.off(serverNotifications,"AutoOrganize_LogReset",onServerEvent),events.off(serverNotifications,"AutoOrganize_ItemUpdated",onServerEvent),events.off(serverNotifications,"AutoOrganize_ItemRemoved",onServerEvent),events.off(serverNotifications,"AutoOrganize_ItemAdded",onServerEvent),events.off(serverNotifications,"ScheduledTaskEnded",onServerEvent),taskButton({mode:"off",button:view.querySelector(".btnOrganize")})})}});